import json
import os
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional
import httpx
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from .schemas import (
    LookupRequest,
    LookupResponse,
    NearestItem,
    NearestSearchResponse,
    OrderCreateRequest,
    OrderResponse,
    PostcodeData,
    WidgetSessionRequest,
    WidgetSessionResponse,
)
from .security import (
    hash_user_pii,
    verify_origin_bound_key,
    create_widget_jwt,
    verify_widget_jwt,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(
    title="FindAm Postcode Service",
    version="1.0.0",
    description="3-Tier Spatial Postcode Resolution API (PostGIS + NIPOST + Offline Abuja Mock Sandbox) for Merchant Checkout, Rider Dispatch & Emergency Response.",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGIN",
        "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MOCK_DATA_PATH = Path(__file__).resolve().parent / "mock_postcodes.json"

# In-memory idempotency fallback store when running offline
_IN_MEMORY_ORDERS: Dict[str, OrderResponse] = {}


def normalize_postcode(raw_code: str) -> str:
    return raw_code.strip().upper().replace(" ", "-")


def format_display_code(code: str) -> str:
    return code.replace("-", " ")


@lru_cache(maxsize=1)
def load_mock_registry() -> dict:
    if not MOCK_DATA_PATH.exists():
        return {}
    with open(MOCK_DATA_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def parse_polygon(raw_poly, fallback_code: str) -> Optional[List[List[float]]]:
    if isinstance(raw_poly, list):
        return raw_poly
    if isinstance(raw_poly, str) and raw_poly.strip().startswith("["):
        try:
            return json.loads(raw_poly)
        except Exception:
            pass
    return load_mock_registry().get(fallback_code, {}).get("building_polygon")


def query_postgis_cache(db: Optional[Session], code: str) -> Optional[PostcodeData]:
    if db is None:
        return None
    try:
        row = db.execute(
            text("""
                SELECT code, state, lga, district, street,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lng,
                       building_polygon,
                       confidence, verified
                FROM postcodes
                WHERE code = :code
                LIMIT 1
            """),
            {"code": code},
        ).mappings().first()
    except Exception:
        db.rollback()
        try:
            row = db.execute(
                text("""
                    SELECT code, state, lga, district, street,
                           ST_Y(location::geometry) AS lat,
                           ST_X(location::geometry) AS lng,
                           confidence, verified
                    FROM postcodes
                    WHERE code = :code
                    LIMIT 1
                """),
                {"code": code},
            ).mappings().first()
        except Exception:
            db.rollback()
            row = None

    if row:
        polygon = parse_polygon(row.get("building_polygon"), code)
        return PostcodeData(
            postcode=row["code"],
            formatted=format_display_code(row["code"]),
            state=row["state"],
            lga=row["lga"],
            district=row["district"],
            street=row["street"],
            lat=float(row["lat"]),
            lng=float(row["lng"]),
            building_polygon=polygon,
            confidence=float(row["confidence"] or 0.97),
            verified=bool(row["verified"]),
            is_alias=False,
        )

    try:
        alias_row = db.execute(
            text("""
                SELECT alias_code, canonical_postcode, alias_name,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lng
                FROM aliases
                WHERE alias_code = :code AND expires_at > NOW()
                LIMIT 1
            """),
            {"code": code},
        ).mappings().first()

        if alias_row:
            return PostcodeData(
                postcode=alias_row["alias_code"],
                formatted=format_display_code(alias_row["alias_code"]),
                state="Federal Capital Territory",
                lga="Abuja Municipal (AMAC)",
                district=alias_row["canonical_postcode"],
                street=alias_row["alias_name"],
                lat=float(alias_row["lat"]),
                lng=float(alias_row["lng"]),
                building_polygon=None,
                confidence=0.85,
                verified=False,
                is_alias=True,
            )
    except Exception:
        db.rollback()
    return None


def cache_to_postgis(db: Optional[Session], item: PostcodeData) -> None:
    if db is None:
        return
    try:
        db.execute(
            text("""
                INSERT INTO postcodes (code, state, lga, district, street, location, confidence, verified)
                VALUES (
                    :code, :state, :lga, :district, :street,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :confidence, :verified
                )
                ON CONFLICT (code) DO NOTHING
            """),
            {
                "code": item.postcode,
                "state": item.state,
                "lga": item.lga,
                "district": item.district,
                "street": item.street,
                "lng": item.lng,
                "lat": item.lat,
                "confidence": item.confidence,
                "verified": item.verified,
            },
        )
        db.commit()
    except Exception:
        db.rollback()


async def execute_lookup(code: str, force_mock: Optional[bool], db: Optional[Session]) -> LookupResponse:
    start_time = time.perf_counter()
    normalized = normalize_postcode(code)

    use_mock_env = os.getenv("USE_MOCK_NIPOST", "true").lower() == "true"
    use_mock = force_mock if force_mock is not None else use_mock_env

    if force_mock is True:
        registry = load_mock_registry()
        if normalized in registry:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return LookupResponse(
                source="mock_cache",
                latency_ms=elapsed,
                data=PostcodeData(**registry[normalized]),
            )

    cached = query_postgis_cache(db, normalized)
    if cached:
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source="postgis_db",
            latency_ms=elapsed,
            data=cached,
        )

    if not use_mock:
        base_url = os.getenv("NIPOST_BASE_URL", "https://api.postcode.gov.ng").rstrip("/")
        api_key = os.getenv("NIPOST_SECRET_KEY") or os.getenv("NIPOST_PUBLISHABLE_KEY")
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    f"{base_url}/v1/lookup",
                    params={"code": normalized, "level": 1},
                    headers={
                        "X-API-Key": api_key or "",
                        "Origin": "http://localhost:8000",
                    },
                )
                if resp.status_code == 200:
                    payload = resp.json().get("data", resp.json())
                    resolved = PostcodeData(
                        postcode=normalized,
                        formatted=payload.get("formatted", format_display_code(normalized)),
                        state=payload.get("state", "Federal Capital Territory"),
                        lga=payload.get("lga", "AMAC"),
                        district=payload.get("district"),
                        street=payload.get("street"),
                        lat=float(payload.get("lat", 9.0765)),
                        lng=float(payload.get("lng", 7.4892)),
                        building_polygon=payload.get("building_polygon"),
                        confidence=float(payload.get("confidence", 0.97)),
                        verified=True,
                    )
                    cache_to_postgis(db, resolved)
                    elapsed = round((time.perf_counter() - start_time) * 1000, 2)
                    return LookupResponse(
                        source="nipost_upstream",
                        latency_ms=elapsed,
                        data=resolved,
                    )
        except Exception:
            pass

    registry = load_mock_registry()
    if normalized in registry:
        resolved = PostcodeData(**registry[normalized])
        cache_to_postgis(db, resolved)
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source="mock_cache",
            latency_ms=elapsed,
            data=resolved,
        )

    raise HTTPException(
        status_code=404,
        detail=f"Postcode '{normalized}' could not be resolved in PostGIS, NIPOST upstream, or local fallback.",
    )


@app.get("/health", tags=["Monitoring"])
def check_health(db: Optional[Session] = Depends(get_db)):
    db_connected = False
    db_error = None
    if db is not None:
        try:
            db.execute(text("SELECT 1"))
            db_connected = True
        except Exception as e:
            db_connected = False
            db_error = str(e)
    return {
        "status": "healthy",
        "postgis_connected": db_connected,
        "upstream_mock": os.getenv("USE_MOCK_NIPOST", "true").lower() == "true",
        "db_error": db_error,
    }


@app.post("/v1/widget/session", response_model=WidgetSessionResponse, tags=["Widget Security"])
def create_widget_session(
    payload: WidgetSessionRequest,
    origin: Optional[str] = Header(default=None),
):
    key_meta = verify_origin_bound_key(payload.publishable_key, origin)
    identity_type, pii_hash = hash_user_pii(nin=payload.nin, email=payload.email)
    token, expires_in = create_widget_jwt(
        pii_hash=pii_hash,
        identity_type=identity_type,
        bound_origin=key_meta["bound_origin"],
        merchant_id=key_meta["merchant_id"],
    )
    return WidgetSessionResponse(
        session_token=token,
        expires_in=expires_in,
        bound_origin=key_meta["bound_origin"],
        identity_type=identity_type,
        subject_hash=pii_hash,
    )


@app.get("/v1/widget/session/verify", tags=["Widget Security"])
def inspect_widget_session(claims: dict = Depends(verify_widget_jwt)):
    return {
        "status": "valid",
        "claims": claims,
    }


@app.post("/v1/lookup", response_model=LookupResponse, tags=["Addressing"])
async def lookup_postcode_post(payload: LookupRequest, db: Optional[Session] = Depends(get_db)):
    return await execute_lookup(payload.code, payload.force_mock, db)


@app.get("/v1/lookup/{code}", response_model=LookupResponse, tags=["Addressing"])
async def lookup_postcode_get(code: str, force_mock: Optional[bool] = None, db: Optional[Session] = Depends(get_db)):
    return await execute_lookup(code, force_mock, db)


@app.get("/v1/mock/postcodes", response_model=Dict[str, PostcodeData], tags=["Sandbox & Mocking"])
def list_mock_postcodes():
    registry = load_mock_registry()
    return {k: PostcodeData(**v) for k, v in registry.items()}


@app.post("/orders", response_model=OrderResponse, tags=["Orders & Dispatch"])
@app.post("/v1/orders", response_model=OrderResponse, tags=["Orders & Dispatch"])
async def create_order(payload: OrderCreateRequest, db: Optional[Session] = Depends(get_db)):
    """
    Creates a spatial delivery order from a postcode with strict idempotency protection.
    Re-submitting the same idempotency_key returns the existing order without double-charging.
    """
    # 1. Check in-memory idempotency cache first
    if payload.idempotency_key in _IN_MEMORY_ORDERS:
        cached_order = _IN_MEMORY_ORDERS[payload.idempotency_key].model_copy()
        cached_order.idempotent_replay = True
        return cached_order

    # 2. Check PostGIS orders table for existing idempotency_key
    if db is not None:
        try:
            existing = db.execute(
                text("""
                    SELECT id, idempotency_key, postcode, status,
                           ST_Y(delivery_location::geometry) AS lat,
                           ST_X(delivery_location::geometry) AS lng
                    FROM orders
                    WHERE idempotency_key = :idem_key
                    LIMIT 1
                """),
                {"idem_key": payload.idempotency_key},
            ).mappings().first()
            if existing:
                resolved_lookup = await execute_lookup(existing["postcode"], None, db)
                place = resolved_lookup.data
                addr = f"{place.street or ''}, {place.district or ''}, {place.lga}".strip(", ")
                resp = OrderResponse(
                    idempotent_replay=True,
                    order_id=str(existing["id"]),
                    idempotency_key=existing["idempotency_key"],
                    postcode=existing["postcode"],
                    delivery_address=addr,
                    lat=float(existing["lat"]),
                    lng=float(existing["lng"]),
                    building_polygon=place.building_polygon,
                    order_status=str(existing.get("status") or "PENDING"),
                )
                _IN_MEMORY_ORDERS[payload.idempotency_key] = resp
                return resp
        except Exception:
            db.rollback()

    # 3. Resolve postcode via 3-tier lookup to get exact delivery coordinates
    lookup_res = await execute_lookup(payload.postcode, None, db)
    place = lookup_res.data
    delivery_address = f"{place.street or ''}, {place.district or ''}, {place.lga}".strip(", ")
    order_id = str(uuid.uuid4())
    order_status = "PENDING"

    # 4. Persist order with PostGIS GEOGRAPHY(Point, 4326) delivery_location
    if db is not None:
        try:
            row = db.execute(
                text("""
                    INSERT INTO orders (idempotency_key, postcode, delivery_location, status)
                    VALUES (
                        :idem_key,
                        :postcode,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        'PENDING'
                    )
                    RETURNING id, status
                """),
                {
                    "idem_key": payload.idempotency_key,
                    "postcode": place.postcode,
                    "lng": place.lng,
                    "lat": place.lat,
                },
            ).mappings().first()
            db.commit()
            if row:
                order_id = str(row["id"])
                order_status = str(row.get("status") or "PENDING")
        except Exception:
            db.rollback()

    response = OrderResponse(
        idempotent_replay=False,
        order_id=order_id,
        idempotency_key=payload.idempotency_key,
        postcode=place.postcode,
        delivery_address=delivery_address,
        lat=place.lat,
        lng=place.lng,
        building_polygon=place.building_polygon,
        order_status=order_status,
    )
    _IN_MEMORY_ORDERS[payload.idempotency_key] = response
    return response


@app.get("/riders/nearest", response_model=NearestSearchResponse, tags=["Orders & Dispatch"])
@app.get("/v1/riders/nearest", response_model=NearestSearchResponse, tags=["Orders & Dispatch"])
def find_nearest_riders(
    lat: float = Query(..., examples=[9.0765], description="Delivery latitude"),
    lng: float = Query(..., examples=[7.4892], description="Delivery longitude"),
    radius_meters: float = Query(default=5000.0, examples=[5000.0], description="Search radius in meters"),
    limit: int = Query(default=5, ge=1, le=20),
    db: Optional[Session] = Depends(get_db),
):
    """
    Uses PostGIS ST_DWithin and the GiST KNN distance operator (<->) to find the closest available riders.
    """
    if db is not None:
        try:
            rows = db.execute(
                text("""
                    SELECT *,
                           ST_Y(current_location::geometry) AS lat,
                           ST_X(current_location::geometry) AS lng,
                           ROUND(
                               ST_Distance(
                                   current_location,
                                   ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                               )::numeric, 1
                           ) AS distance_meters
                    FROM riders
                    WHERE ST_DWithin(
                        current_location,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :radius
                    )
                    ORDER BY current_location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    LIMIT :limit
                """),
                {"lat": lat, "lng": lng, "radius": radius_meters, "limit": limit},
            ).mappings().all()
        except Exception:
            db.rollback()
            try:
                rows = db.execute(
                    text("""
                        SELECT *,
                               ST_Y(location::geometry) AS lat,
                               ST_X(location::geometry) AS lng,
                               ROUND(
                                   ST_Distance(
                                       location,
                                       ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                                   )::numeric, 1
                               ) AS distance_meters
                        FROM riders
                        WHERE ST_DWithin(
                            location,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                            :radius
                        )
                        ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                        LIMIT :limit
                    """),
                    {"lat": lat, "lng": lng, "radius": radius_meters, "limit": limit},
                ).mappings().all()
            except Exception:
                db.rollback()
                rows = []

        if rows:
            items = [
                NearestItem(
                    id=str(r.get("id") or idx),
                    name=str(r.get("name") or r.get("rider_name") or f"Rider {idx}"),
                    category_or_status=str(r.get("status") or ("AVAILABLE" if r.get("is_available", True) else "BUSY")),
                    phone=r.get("phone") or r.get("phone_number"),
                    lat=float(r["lat"]),
                    lng=float(r["lng"]),
                    distance_meters=float(r["distance_meters"]),
                )
                for idx, r in enumerate(rows, start=1)
            ]
            return NearestSearchResponse(
                source="postgis_gist_knn",
                search_center={"lat": lat, "lng": lng},
                radius_meters=radius_meters,
                count=len(items),
                results=items,
            )

    # Offline Abuja Rider Fallback
    fallback_riders = [
        NearestItem(
            id="rdr-abuja-01",
            name="Musa Abdullahi (Wuse II Dispatch)",
            category_or_status="AVAILABLE",
            phone="+2348031112233",
            lat=9.0770,
            lng=7.4895,
            distance_meters=64.5,
        ),
        NearestItem(
            id="rdr-abuja-02",
            name="Chinedu Okafor (Garki Express)",
            category_or_status="AVAILABLE",
            phone="+2348054445566",
            lat=9.0390,
            lng=7.5015,
            distance_meters=1420.0,
        ),
    ]
    return NearestSearchResponse(
        source="mock_fallback",
        search_center={"lat": lat, "lng": lng},
        radius_meters=radius_meters,
        count=len(fallback_riders),
        results=fallback_riders,
    )


@app.get("/emergency/nearest", response_model=NearestSearchResponse, tags=["Emergency Response"])
@app.get("/v1/emergency/nearest", response_model=NearestSearchResponse, tags=["Emergency Response"])
def find_nearest_emergency(
    lat: float = Query(..., examples=[9.0765], description="Caller latitude"),
    lng: float = Query(..., examples=[7.4892], description="Caller longitude"),
    type: str = Query(default="HOSPITAL", examples=["HOSPITAL", "POLICE", "FIRE"], description="Emergency facility type"),
    radius_meters: float = Query(default=10000.0, examples=[10000.0], description="Search radius in meters"),
    limit: int = Query(default=5, ge=1, le=20),
    db: Optional[Session] = Depends(get_db),
):
    """
    Uses PostGIS ST_DWithin and the GiST KNN distance operator (<->) to locate the nearest emergency responder.
    """
    facility_type = type.strip().upper()
    if db is not None:
        for table_name in ("emergency_services", "emergency_facilities", "emergencies"):
            for type_col in ("type", "service_type", "facility_type", "category"):
                try:
                    rows = db.execute(
                        text(f"""
                            SELECT *,
                                   ST_Y(location::geometry) AS lat,
                                   ST_X(location::geometry) AS lng,
                                   ROUND(
                                       ST_Distance(
                                           location,
                                           ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                                       )::numeric, 1
                                   ) AS distance_meters
                            FROM {table_name}
                            WHERE UPPER({type_col}) = :ftype
                              AND ST_DWithin(
                                  location,
                                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                                  :radius
                              )
                            ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                            LIMIT :limit
                        """),
                        {"lat": lat, "lng": lng, "ftype": facility_type, "radius": radius_meters, "limit": limit},
                    ).mappings().all()
                    if rows:
                        items = [
                            NearestItem(
                                id=str(r.get("id") or idx),
                                name=str(r.get("name") or r.get("facility_name") or f"{facility_type} {idx}"),
                                category_or_status=str(r.get(type_col) or facility_type),
                                phone=r.get("phone") or r.get("emergency_phone") or r.get("contact_phone"),
                                lat=float(r["lat"]),
                                lng=float(r["lng"]),
                                distance_meters=float(r["distance_meters"]),
                            )
                            for idx, r in enumerate(rows, start=1)
                        ]
                        return NearestSearchResponse(
                            source="postgis_gist_knn",
                            search_center={"lat": lat, "lng": lng},
                            radius_meters=radius_meters,
                            count=len(items),
                            results=items,
                        )
                except Exception:
                    db.rollback()

    # Offline Abuja Emergency Fallback
    fallback_emergency = [
        NearestItem(
            id="emg-abuja-01",
            name="Nisa Premier Hospital (Jabi / Wuse Axis)",
            category_or_status=facility_type,
            phone="112",
            lat=9.0667,
            lng=7.4310,
            distance_meters=1150.0,
        ),
        NearestItem(
            id="emg-abuja-02",
            name="National Hospital Abuja (Central District)",
            category_or_status=facility_type,
            phone="112",
            lat=9.0398,
            lng=7.4631,
            distance_meters=2890.0,
        ),
    ]
    return NearestSearchResponse(
        source="mock_fallback",
        search_center={"lat": lat, "lng": lng},
        radius_meters=radius_meters,
        count=len(fallback_emergency),
        results=fallback_emergency,
    )
