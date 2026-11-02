import json
import os
import time
from pathlib import Path
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from .schemas import LookupRequest, LookupResponse, PostcodeData

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(
    title="postcode360 Postcode Service",
    version="1.0.0",
    description="Backend routing and address normalization service integrating NIPOST digital postcodes with PostGIS.",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGIN", "http://localhost:3000").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MOCK_DATA_PATH = Path(__file__).resolve().parent / "mock_postcodes.json"


def normalize_postcode(raw_code: str) -> str:
    cleaned = raw_code.strip().upper().replace(" ", "-")
    return cleaned


def format_display_code(code: str) -> str:
    return code.replace("-", " ")


def load_mock_registry() -> dict:
    if not MOCK_DATA_PATH.exists():
        return {}
    with open(MOCK_DATA_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def query_postgis_cache(db: Optional[Session], code: str) -> Optional[PostcodeData]:
    if db is None:
        return None
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

        if row:
            mock_reg = load_mock_registry()
            polygon = mock_reg.get(code, {}).get("building_polygon")
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
        return None
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
    if db is not None:
        try:
            db.execute(text("SELECT 1"))
            db_connected = True
        except Exception:
            db_connected = False
    return {
        "status": "healthy",
        "postgis_connected": db_connected,
        "upstream_mock": os.getenv("USE_MOCK_NIPOST", "true").lower() == "true",
    }


@app.post("/v1/lookup", response_model=LookupResponse, tags=["Addressing"])
async def lookup_postcode_post(payload: LookupRequest, db: Optional[Session] = Depends(get_db)):
    return await execute_lookup(payload.code, payload.force_mock, db)


@app.get("/v1/lookup/{code}", response_model=LookupResponse, tags=["Addressing"])
async def lookup_postcode_get(code: str, force_mock: Optional[bool] = None, db: Optional[Session] = Depends(get_db)):
    return await execute_lookup(code, force_mock, db)
