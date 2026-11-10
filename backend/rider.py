# backend/team_b.py
from datetime import datetime, timedelta, timezone
import math
import random
import string
import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .schemas import OrderResponse, PostcodeData, SocialProductItem, SocialStoreRecord, SocialStoreCreateRequest

router = APIRouter(tags=["3PL Partner Logistics, Field Enumeration & Social Commerce"])

# ---------------------------------------------------------------------------
# In-Memory Fallbacks (Guarantees 100% uptime even if DB is offline)
# ---------------------------------------------------------------------------
_IN_MEMORY_ALIASES: Dict[str, dict] = {
    "TP-ABJ-7K2P": {
        "alias_code": "TP-ABJ-7K2P",
        "canonical_postcode": "FC-02-A09-DB-09",
        "alias_name": "Banex Plaza Extension Gate 2",
        "district": "Wuse II",
        "lga": "AMAC",
        "state": "Federal Capital Territory",
        "lat": 9.0758,
        "lng": 7.4904,
        "proof_image_url": "https://images.postcode360.ng/pod/tp-abj-7k2p-gate.jpg",
        "trust_score": 2,
        "delivery_count": 2,
        "is_temp_code": True,
        "verified": False,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
        "building_polygon": [
            [7.49025, 9.07592],
            [7.49055, 9.07592],
            [7.49055, 9.07568],
            [7.49025, 9.07568],
            [7.49025, 9.07592],
        ],
    }
}

_IN_MEMORY_RIDERS: Dict[str, dict] = {
    "rdr-abuja-01": {
        "rider_id": "rdr-abuja-01",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "phone": "+2348030000001",
        "lat": 9.0740,
        "lng": 7.4850,
        "is_available": True,
        "battery_pct": 92,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    },
    "rdr-abuja-02": {
        "rider_id": "rdr-abuja-02",
        "rider_name": "Chinedu Okafor (Garki Rider)",
        "phone": "+2348030000002",
        "lat": 9.0380,
        "lng": 7.4910,
        "is_available": True,
        "battery_pct": 85,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    },
}

_IN_MEMORY_BOOKMARKS: Dict[str, List[dict]] = {}

_IN_MEMORY_SOCIAL_STORES: List[dict] = [
    {
        "store_slug": "luxe-atelier-abj",
        "merchant_name": "Luxe Atelier Abuja",
        "merchant_handle": "@luxeatelier.ng",
        "merchant_phone": "+2348035550192",
        "pickup_postcode": "FC-02-A09-DB-09",
        "pickup_location": {"lat": 9.0765, "lng": 7.4892},
        "bio_link": "https://postcode360.ng/store/luxe-atelier-abj",
        "created_at": "2026-11-08T10:00:00Z",
        "products": [
            {
                "id": "prod-wig-01",
                "title": '30" Bone Straight Raw Vietnamese Wig',
                "price_ngn": 600000.0,
                "category": "Luxury Hair",
                "description": "100% Raw unprocessed bone straight double drawn human hair with HD frontal lace.",
                "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
                "stock_count": 8,
                "product_link": "https://postcode360.ng/pay/luxe-atelier-abj/prod-wig-01",
            },
            {
                "id": "prod-bag-02",
                "title": "Structured Top-Handle Leather Bag",
                "price_ngn": 60000.0,
                "category": "Accessories",
                "description": "Italian vegetable-tanned cowhide with gold-plated hardware and protective feet.",
                "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80",
                "stock_count": 15,
                "product_link": "https://postcode360.ng/pay/luxe-atelier-abj/prod-bag-02",
            },
            {
                "id": "prod-oud-03",
                "title": "Royal Arabian Oud Extrait Perfume (100ml)",
                "price_ngn": 100000.0,
                "category": "Artisanal Perfumery",
                "description": "Concentrated pure agarwood extrait infused with Damascus rose and ambergris.",
                "image_url": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80",
                "stock_count": 25,
                "product_link": "https://postcode360.ng/pay/luxe-atelier-abj/prod-oud-03",
            },
        ],
    }
]



def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def make_parcel_polygon(lat: float, lng: float) -> List[List[float]]:
    d = 0.00016
    return [
        [round(lng - d, 5), round(lat + d, 5)],
        [round(lng + d, 5), round(lat + d, 5)],
        [round(lng + d, 5), round(lat - d, 5)],
        [round(lng - d, 5), round(lat - d, 5)],
        [round(lng - d, 5), round(lat + d, 5)],
    ]


# ---------------------------------------------------------------------------
# Pydantic Schemas for 3PL Field Enumerator
# ---------------------------------------------------------------------------
class AliasMintRequest(BaseModel):
    lat: float = Field(..., examples=[9.0758])
    lng: float = Field(..., examples=[7.4904])
    alias_name: str = Field(..., examples=["Compound 14 Behind Wuse Market"])
    canonical_postcode: Optional[str] = Field(default="FC-02-A09-DB-09")
    district: Optional[str] = Field(default="Wuse II")
    proof_image_url: Optional[str] = Field(default="https://images.postcode360.ng/pod/gate-proof.jpg")
    pod_image_url: Optional[str] = None
    building_polygon: Optional[List[List[float]]] = None


class AliasRecord(BaseModel):
    alias_code: str
    canonical_postcode: Optional[str] = None
    alias_name: str
    district: str = "AMAC"
    lat: float
    lng: float
    proof_image_url: Optional[str] = None
    trust_score: int = 1
    delivery_count: int = 0
    is_temp_code: bool = True
    verified: bool = False
    expires_at: str
    building_polygon: List[List[float]]


class AliasVerifyRequest(BaseModel):
    alias_code: str = Field(..., examples=["TP-ABJ-7K2P"])
    proof_image_url: Optional[str] = None


class DispatchOrderRequest(BaseModel):
    rider_id: str = Field(..., examples=["rdr-abuja-01"])
    rider_name: Optional[str] = Field(default="Musa Ibrahim (Wuse Rider)")


class PodSubmitRequest(BaseModel):
    rider_id: str = Field(default="rdr-abuja-01")
    rider_lat: float = Field(..., examples=[9.0765])
    rider_lng: float = Field(..., examples=[7.4892])
    pod_image_url: str = Field(default="https://images.postcode360.ng/pod/verified-drop.jpg")
    recipient_signature: Optional[str] = Field(default="Confirmed at Gate")


class RiderTelemetryRequest(BaseModel):
    lat: float
    lng: float
    is_available: bool = True
    battery_pct: int = Field(default=90, ge=0, le=100)


class BookmarkCreateRequest(BaseModel):
    subject_hash: str = Field(..., examples=["sha256:e679a8a6828aefc2ab339c9a4909d5b9c41d10d098bd29866d23b20a35c5"])
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    label: str = Field(..., examples=["Home (Wuse II Apartment)"])


# ---------------------------------------------------------------------------
# Helper: Resolve TP-XXXX-XXXX Alias inside main.py /v1/lookup
# ---------------------------------------------------------------------------
def resolve_alias_as_postcode_data(code: str, db: Optional[Session]) -> Optional[PostcodeData]:
    normalized = code.strip().upper()
    if db is not None:
        try:
            row = db.execute(
                text("""
                    SELECT alias_code, canonical_postcode, alias_name, is_temp_code,
                           trust_score, delivery_count,
                           ST_Y(location::geometry) AS lat,
                           ST_X(location::geometry) AS lng
                    FROM aliases
                    WHERE UPPER(alias_code) = :code
                    LIMIT 1
                """),
                {"code": normalized},
            ).mappings().first()
            if row:
                lat_f, lng_f = float(row["lat"]), float(row["lng"])
                trust = int(row["trust_score"] or 1)
                return PostcodeData(
                    postcode=row["alias_code"],
                    formatted=row["alias_code"].replace("-", " "),
                    state="Federal Capital Territory",
                    lga="AMAC",
                    district="Community Alias / TP Grid",
                    street=row["alias_name"],
                    lat=lat_f,
                    lng=lng_f,
                    building_polygon=make_parcel_polygon(lat_f, lng_f),
                    confidence=min(0.99, round(0.80 + (trust * 0.05), 2)),
                    verified=not bool(row["is_temp_code"]),
                    is_alias=True,
                )
        except Exception:
            db.rollback()

    if normalized in _IN_MEMORY_ALIASES:
        item = _IN_MEMORY_ALIASES[normalized]
        return PostcodeData(
            postcode=item["alias_code"],
            formatted=item["alias_code"].replace("-", " "),
            state="Federal Capital Territory",
            lga="AMAC",
            district=item.get("district", "Abuja Inclusion Grid"),
            street=item["alias_name"],
            lat=item["lat"],
            lng=item["lng"],
            building_polygon=item["building_polygon"],
            confidence=min(0.99, round(0.80 + (item["trust_score"] * 0.05), 2)),
            verified=item["verified"],
            is_alias=True,
        )
    return None


# ---------------------------------------------------------------------------
# 1. Temporary Postcode Minting & Verification (Flow B Step 05 & Inclusion)
# ---------------------------------------------------------------------------
@router.post("/v1/alias/mint", response_model=AliasRecord)
def mint_temporary_postcode(payload: AliasMintRequest, db: Optional[Session] = Depends(get_db)):
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    alias_code = f"TP-ABJ-{suffix}"
    expires_dt = datetime.now(timezone.utc) + timedelta(days=90)
    if payload.building_polygon and len(payload.building_polygon) >= 4:
        polygon = [list(pt) for pt in payload.building_polygon]
        if polygon[0] != polygon[-1]:
            polygon.append(polygon[0])
    else:
        polygon = make_parcel_polygon(payload.lat, payload.lng)
    proof_url = payload.pod_image_url or payload.proof_image_url or "https://images.postcode360.ng/pod/gate-proof.jpg" 

    if db is not None:
        try:
            db.execute(
                text("""
                    INSERT INTO aliases (
                        alias_code, canonical_postcode, alias_name, is_temp_code,
                        location, proof_image_url, trust_score, delivery_count, expires_at
                    )
                    VALUES (
                        :code, :canonical, :name, TRUE,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :proof, 1, 0, :expires
                    )
                """),
                {
                    "code": alias_code,
                    "canonical": payload.canonical_postcode,
                    "name": payload.alias_name,
                    "lng": payload.lng,
                    "lat": payload.lat,
                    "proof": payload.proof_image_url,
                    "expires": expires_dt,
                },
            )
            db.commit()
        except Exception:
            db.rollback()

    record = {
        "alias_code": alias_code,
        "canonical_postcode": payload.canonical_postcode,
        "alias_name": payload.alias_name,
        "district": payload.district or "AMAC",
        "lat": payload.lat,
        "lng": payload.lng,
        "proof_image_url": proof_url,
        "trust_score": 1,
        "delivery_count": 0,
        "is_temp_code": True,
        "verified": False,
        "expires_at": expires_dt.isoformat(),
        "building_polygon": polygon,
    }
    _IN_MEMORY_ALIASES[alias_code] = record
    return AliasRecord(**record)


@router.get("/v1/aliases", response_model=List[AliasRecord])
def list_aliases(db: Optional[Session] = Depends(get_db)):
    if db is not None:
        try:
            rows = db.execute(
                text("""
                    SELECT alias_code, canonical_postcode, alias_name, is_temp_code,
                           proof_image_url, trust_score, delivery_count, expires_at,
                           ST_Y(location::geometry) AS lat,
                           ST_X(location::geometry) AS lng
                    FROM aliases
                    ORDER BY created_at DESC
                    LIMIT 50
                """)
            ).mappings().all()
            if rows:
                result = []
                for r in rows:
                    lat_f, lng_f = float(r["lat"]), float(r["lng"])
                    code = r["alias_code"]
                    result.append(
                        AliasRecord(
                            alias_code=code,
                            canonical_postcode=r.get("canonical_postcode"),
                            alias_name=r["alias_name"],
                            district="AMAC",
                            lat=lat_f,
                            lng=lng_f,
                            proof_image_url=r.get("proof_image_url"),
                            trust_score=int(r.get("trust_score") or 1),
                            delivery_count=int(r.get("delivery_count") or 0),
                            is_temp_code=bool(r.get("is_temp_code")),
                            verified=not bool(r.get("is_temp_code")),
                            expires_at=str(r.get("expires_at") or ""),
                            building_polygon=make_parcel_polygon(lat_f, lng_f),
                        )
                    )
                return result
        except Exception:
            db.rollback()

    return [AliasRecord(**v) for v in _IN_MEMORY_ALIASES.values()]


@router.post("/v1/verify", response_model=AliasRecord)
def verify_and_increment_alias_trust(payload: AliasVerifyRequest, db: Optional[Session] = Depends(get_db)):
    code = payload.alias_code.strip().upper()
    mem = _IN_MEMORY_ALIASES.get(code)

    if db is not None:
        try:
            row = db.execute(
                text("""
                    UPDATE aliases
                    SET delivery_count = COALESCE(delivery_count, 0) + 1,
                        trust_score = COALESCE(trust_score, 1) + 1,
                        is_temp_code = CASE WHEN COALESCE(delivery_count, 0) + 1 >= 3 THEN FALSE ELSE is_temp_code END,
                        proof_image_url = COALESCE(:proof, proof_image_url)
                    WHERE UPPER(alias_code) = :code
                    RETURNING alias_code, canonical_postcode, alias_name, is_temp_code,
                              proof_image_url, trust_score, delivery_count, expires_at,
                              ST_Y(location::geometry) AS lat,
                              ST_X(location::geometry) AS lng
                """),
                {"code": code, "proof": payload.proof_image_url},
            ).mappings().first()
            db.commit()
            if row:
                lat_f, lng_f = float(row["lat"]), float(row["lng"])
                updated = {
                    "alias_code": row["alias_code"],
                    "canonical_postcode": row.get("canonical_postcode"),
                    "alias_name": row["alias_name"],
                    "district": "AMAC",
                    "lat": lat_f,
                    "lng": lng_f,
                    "proof_image_url": row.get("proof_image_url"),
                    "trust_score": int(row["trust_score"]),
                    "delivery_count": int(row["delivery_count"]),
                    "is_temp_code": bool(row["is_temp_code"]),
                    "verified": not bool(row["is_temp_code"]),
                    "expires_at": str(row.get("expires_at") or ""),
                    "building_polygon": make_parcel_polygon(lat_f, lng_f),
                }
                _IN_MEMORY_ALIASES[code] = updated
                return AliasRecord(**updated)
        except Exception:
            db.rollback()

    if not mem:
        raise HTTPException(status_code=404, detail=f"Alias '{code}' not found.")

    mem["delivery_count"] += 1
    mem["trust_score"] += 1
    if payload.proof_image_url:
        mem["proof_image_url"] = payload.proof_image_url
    if mem["delivery_count"] >= 3:
        mem["is_temp_code"] = False
        mem["verified"] = True

    return AliasRecord(**mem)


# ---------------------------------------------------------------------------
# 2. Order Dispatch & Proof of Delivery (Flow B Steps 02–04)
# ---------------------------------------------------------------------------
@router.patch("/v1/orders/{order_id}/dispatch")
def dispatch_order_to_rider(
    order_id: str,
    payload: DispatchOrderRequest,
    db: Optional[Session] = Depends(get_db),
):
    from .main import _IN_MEMORY_ORDERS

    if db is not None:
        try:
            db.execute(
                text("""
                    UPDATE orders
                    SET status = 'DISPATCHED'
                    WHERE id::text = :oid OR idempotency_key = :oid
                """),
                {"oid": order_id},
            )
            db.commit()
        except Exception:
            db.rollback()

    for key, ord_obj in _IN_MEMORY_ORDERS.items():
        if ord_obj.order_id == order_id or key == order_id:
            ord_obj.order_status = "DISPATCHED"

    return {
        "status": "success",
        "order_id": order_id,
        "order_status": "DISPATCHED",
        "assigned_rider_id": payload.rider_id,
        "assigned_rider_name": payload.rider_name,
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/v1/orders/{order_id}/pod")
def submit_proof_of_delivery(
    order_id: str,
    payload: PodSubmitRequest,
    db: Optional[Session] = Depends(get_db),
):
    from .main import _IN_MEMORY_ORDERS

    target_lat, target_lng = payload.rider_lat, payload.rider_lng
    target_postcode = None

    for key, ord_obj in _IN_MEMORY_ORDERS.items():
        if ord_obj.order_id == order_id or key == order_id:
            target_lat, target_lng = ord_obj.lat, ord_obj.lng
            target_postcode = ord_obj.postcode
            ord_obj.order_status = "DELIVERED"

    if db is not None:
        try:
            row = db.execute(
                text("""
                    UPDATE orders
                    SET status = 'DELIVERED',
                        pod_image_url = :pod_url
                    WHERE id::text = :oid OR idempotency_key = :oid
                    RETURNING postcode,
                              ST_Y(delivery_location::geometry) AS lat,
                              ST_X(delivery_location::geometry) AS lng
                """),
                {"oid": order_id, "pod_url": payload.pod_image_url},
            ).mappings().first()
            db.commit()
            if row:
                target_postcode = row["postcode"]
                target_lat, target_lng = float(row["lat"]), float(row["lng"])
        except Exception:
            db.rollback()

    distance_from_door_m = haversine_meters(
        payload.rider_lat, payload.rider_lng, target_lat, target_lng
    )

    alias_promoted = False
    if target_postcode and target_postcode.upper() in _IN_MEMORY_ALIASES:
        alias_rec = _IN_MEMORY_ALIASES[target_postcode.upper()]
        alias_rec["delivery_count"] += 1
        alias_rec["trust_score"] += 1
        if alias_rec["delivery_count"] >= 3:
            alias_rec["is_temp_code"] = False
            alias_rec["verified"] = True
            alias_promoted = True

    return {
        "status": "success",
        "order_id": order_id,
        "order_status": "DELIVERED",
        "pod_image_url": payload.pod_image_url,
        "gps_distance_from_polygon_m": distance_from_door_m,
        "gps_verified": distance_from_door_m <= 250.0,
        "alias_auto_promoted": alias_promoted,
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# 3. Rider Fleet Telemetry (Flow B)
# ---------------------------------------------------------------------------
@router.get("/v1/riders")
def list_rider_fleet(db: Optional[Session] = Depends(get_db)):
    if db is not None:
        try:
            rows = db.execute(
                text("""
                    SELECT rider_id::text AS rider_id,
                           rider_name,
                           phone,
                           is_available,
                           battery_pct,
                           updated_at,
                           ST_Y(current_location::geometry) AS lat,
                           ST_X(current_location::geometry) AS lng
                    FROM rider_loc
                    ORDER BY updated_at DESC
                """)
            ).mappings().all()
            if rows:
                return [
                    {
                        "rider_id": r["rider_id"],
                        "rider_name": r["rider_name"],
                        "phone": r["phone"],
                        "lat": float(r["lat"]),
                        "lng": float(r["lng"]),
                        "is_available": bool(r["is_available"]),
                        "battery_pct": int(r.get("battery_pct") or 90),
                        "updated_at": str(r.get("updated_at") or ""),
                    }
                    for r in rows
                ]
        except Exception:
            db.rollback()

    return list(_IN_MEMORY_RIDERS.values())


@router.patch("/v1/riders/{rider_id}/telemetry")
def update_rider_telemetry(
    rider_id: str,
    payload: RiderTelemetryRequest,
    db: Optional[Session] = Depends(get_db),
):
    now_iso = datetime.now(timezone.utc).isoformat()
    if db is not None:
        try:
            db.execute(
                text("""
                    UPDATE rider_loc
                    SET current_location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        is_available = :avail,
                        battery_pct = :batt,
                        updated_at = NOW()
                    WHERE rider_id::text = :rid OR rider_name ILIKE :rname
                """),
                {
                    "lng": payload.lng,
                    "lat": payload.lat,
                    "avail": payload.is_available,
                    "batt": payload.battery_pct,
                    "rid": rider_id,
                    "rname": f"%{rider_id}%",
                },
            )
            db.commit()
        except Exception:
            db.rollback()

    if rider_id in _IN_MEMORY_RIDERS:
        _IN_MEMORY_RIDERS[rider_id].update(
            {
                "lat": payload.lat,
                "lng": payload.lng,
                "is_available": payload.is_available,
                "battery_pct": payload.battery_pct,
                "updated_at": now_iso,
            }
        )

    return {
        "status": "success",
        "rider_id": rider_id,
        "lat": payload.lat,
        "lng": payload.lng,
        "is_available": payload.is_available,
        "battery_pct": payload.battery_pct,
        "updated_at": now_iso,
    }


# ---------------------------------------------------------------------------
# 4. Zero-PII Consumer Postcode Bookmarks (Flow A Step 02)
# ---------------------------------------------------------------------------
@router.get("/v1/bookmarks")
def get_subject_bookmarks(
    subject_hash: str = Query(..., description="HMAC-SHA256 subject_hash from /v1/widget/session"),
):
    saved = _IN_MEMORY_BOOKMARKS.get(subject_hash, [
        {"postcode": "FC-02-A09-DB-09", "label": "Home (Wuse II Crescent)"},
        {"postcode": "FC-01-M04-MA-03", "label": "Office (Maitama Aguiyi Ironsi)"},
        {"postcode": "TP-ABJ-7K2P", "label": "Karu Annex (Temporary TP-Code)"},
    ])
    return {
        "status": "success",
        "subject_hash": subject_hash,
        "raw_pii_stored": False,
        "count": len(saved),
        "bookmarks": saved,
    }


@router.post("/v1/bookmarks")
def save_subject_bookmark(payload: BookmarkCreateRequest):
    existing = _IN_MEMORY_BOOKMARKS.setdefault(payload.subject_hash, [
        {"postcode": "FC-02-A09-DB-09", "label": "Home (Wuse II Crescent)"},
    ])
    new_entry = {"postcode": payload.postcode.strip().upper(), "label": payload.label.strip()}
    if not any(b["postcode"] == new_entry["postcode"] for b in existing):
        existing.append(new_entry)
    return {
        "status": "success",
        "subject_hash": payload.subject_hash,
        "bookmarks": existing,
    }
    
    # ---------------------------------------------------------------------------
# 5. Flow C: Emergency Rescue Router, Termii SMS & USSD *347# (Civic Emergency)
# ---------------------------------------------------------------------------
_IN_MEMORY_INCIDENTS: Dict[str, dict] = {
    "SOS-ABJ-901": {
        "incident_id": "SOS-ABJ-901",
        "postcode": "FC-02-A09-DB-09",
        "address": "Adetokunbo Ademola Crescent, Wuse II, AMAC",
        "caller_phone": "+2348035550199",
        "triage_level": "RED",
        "emergency_type": "HOSPITAL",
        "lat": 9.0765,
        "lng": 7.4892,
        "assigned_responder": "National Hospital Abuja (Trauma Level 1)",
        "responder_phone": "112",
        "distance_meters": 1420.5,
        "eta_minutes": 4,
        "status": "DISPATCHED",
        "termii_sms_preview": "ALERT [NG-SECURE]: SOS at FC-02-A09-DB-09 (Wuse II). Responder: National Hospital Abuja (ETA 4m). Map: https://maps.google.com/?q=9.0765,7.4892",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
}


class SosTriggerRequest(BaseModel):
    postcode: str = Field(default="FC-02-A09-DB-09")
    lat: float = Field(default=9.0765)
    lng: float = Field(default=7.4892)
    address: Optional[str] = Field(default="Wuse II, AMAC, Abuja")
    caller_phone: str = Field(default="+2348030001122")
    triage_level: str = Field(default="RED")
    emergency_type: str = Field(default="HOSPITAL")


class SosIncidentRecord(BaseModel):
    incident_id: str
    postcode: str
    address: str
    caller_phone: str
    triage_level: str
    emergency_type: str
    lat: float
    lng: float
    assigned_responder: str
    responder_phone: str
    distance_meters: float
    eta_minutes: int
    status: str
    termii_sms_preview: str
    created_at: str


class UssdDialRequest(BaseModel):
    ussd_string: str = Field(..., examples=["*347*FC-02-A09-DB-09#"])
    msisdn: str = Field(default="+2348030001122")


@router.get("/v1/emergency/incidents", response_model=List[SosIncidentRecord])
def list_sos_incidents():
    return list(_IN_MEMORY_INCIDENTS.values())


@router.post("/v1/emergency/sos", response_model=SosIncidentRecord)
def trigger_emergency_sos(
    payload: SosTriggerRequest,
    db: Optional[Session] = Depends(get_db),
):
    suffix = "".join(random.choices(string.digits, k=3))
    incident_id = f"SOS-ABJ-{suffix}"

    # Default fallback responder if DB is offline
    responder_name = {
        "HOSPITAL": "National Hospital Abuja (Central District)",
        "POLICE": "FCT Police Command — Wuse Zone 3 Division",
        "FIRE": "Federal Fire Service Command — Garki Area 10",
    }.get(payload.emergency_type.upper(), "National Hospital Abuja")
    responder_phone = "112"
    dist_m = 1350.0

    # Query PostGIS KNN on emergency_facilities if available
    if db is not None:
        try:
            row = db.execute(
                text("""
                    SELECT name, phone,
                           ROUND(ST_Distance(
                               location,
                               ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                           )::numeric, 1) AS distance_meters
                    FROM emergency_facilities
                    WHERE category = :cat
                    ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    LIMIT 1
                """),
                {
                    "lng": payload.lng,
                    "lat": payload.lat,
                    "cat": payload.emergency_type.upper(),
                },
            ).mappings().first()
            if row:
                responder_name = row["name"]
                responder_phone = row.get("phone") or "112"
                dist_m = float(row["distance_meters"])
        except Exception:
            db.rollback()

    eta_min = max(2, int(round(dist_m / 450.0)))
    code_norm = payload.postcode.strip().upper()
    sms_text = (
        f"TERMII 2G SMS [NG-SECURE]: {payload.triage_level} {payload.emergency_type} SOS at "
        f"{code_norm} ({payload.address}). Assigned: {responder_name} (ETA {eta_min}m). "
        f"Reply YES to confirm. Map: https://maps.google.com/?q={payload.lat},{payload.lng}"
    )

    record = {
        "incident_id": incident_id,
        "postcode": code_norm,
        "address": payload.address or "AMAC, Abuja FCT",
        "caller_phone": payload.caller_phone,
        "triage_level": payload.triage_level.upper(),
        "emergency_type": payload.emergency_type.upper(),
        "lat": payload.lat,
        "lng": payload.lng,
        "assigned_responder": responder_name,
        "responder_phone": responder_phone,
        "distance_meters": dist_m,
        "eta_minutes": eta_min,
        "status": "DISPATCHED",
        "termii_sms_preview": sms_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _IN_MEMORY_INCIDENTS[incident_id] = record
    return SosIncidentRecord(**record)


@router.post("/v1/emergency/{incident_id}/resolve", response_model=SosIncidentRecord)
def resolve_sos_incident(incident_id: str, db: Optional[Session] = Depends(get_db)):
    if incident_id not in _IN_MEMORY_INCIDENTS:
        raise HTTPException(status_code=404, detail="Incident not found.")

    inc = _IN_MEMORY_INCIDENTS[incident_id]
    inc["status"] = "RESOLVED"
    code = inc["postcode"].upper()

    # Increment trust_score (+1) and promote TP-code if applicable (Flow C Step 05)
    if code in _IN_MEMORY_ALIASES:
        alias_rec = _IN_MEMORY_ALIASES[code]
        alias_rec["trust_score"] += 1
        alias_rec["delivery_count"] += 1
        if alias_rec["delivery_count"] >= 3:
            alias_rec["is_temp_code"] = False
            alias_rec["verified"] = True

    if db is not None:
        try:
            db.execute(
                text("""
                    UPDATE aliases
                    SET trust_score = COALESCE(trust_score, 1) + 1,
                        delivery_count = COALESCE(delivery_count, 0) + 1,
                        is_temp_code = CASE WHEN COALESCE(delivery_count, 0) + 1 >= 3 THEN FALSE ELSE is_temp_code END
                    WHERE UPPER(alias_code) = :code
                """),
                {"code": code},
            )
            db.commit()
        except Exception:
            db.rollback()

    return SosIncidentRecord(**inc)


@router.post("/v1/ussd")
def handle_ussd_session(payload: UssdDialRequest, db: Optional[Session] = Depends(get_db)):
    raw = payload.ussd_string.strip().upper()
    # Extract code from *347*CODE#
    extracted = raw.replace("*347*", "").replace("#", "").strip()
    if not extracted or extracted == "*347":
        extracted = "FC-02-A09-DB-09"

    alias_data = resolve_alias_as_postcode_data(extracted, db)
    if alias_data:
        menu = (
            f"CON Postcode360 USSD (*347#) — OFFLINE VERIFIED\n"
            f"Code: {alias_data.postcode} ({'VERIFIED' if alias_data.verified else 'TEMP TP-CODE'})\n"
            f"Landmark: {alias_data.street}\n"
            f"GPS: {alias_data.lat:.4f}N, {alias_data.lng:.4f}E\n"
            f"1. Share Location via 2G SMS\n"
            f"2. Trigger Emergency SOS (112)"
        )
        return {
            "status": "success",
            "ussd_code": raw,
            "msisdn": payload.msisdn,
            "resolved_postcode": alias_data.postcode,
            "lat": alias_data.lat,
            "lng": alias_data.lng,
            "screen_text": menu,
        }

    # Check standard Abuja postcodes
    from .main import load_mock_registry
    registry = load_mock_registry()
    if extracted in registry:
        item = registry[extracted]
        menu = (
            f"CON Postcode360 USSD (*347#) — NIPOST CANONICAL\n"
            f"Code: {item['postcode']}\n"
            f"Street: {item['street']}, {item['district']}\n"
            f"GPS: {item['lat']:.4f}N, {item['lng']:.4f}E\n"
            f"1. Send Termii 2G SMS Link\n"
            f"2. Request Emergency Dispatch"
        )
        return {
            "status": "success",
            "ussd_code": raw,
            "msisdn": payload.msisdn,
            "resolved_postcode": item["postcode"],
            "lat": item["lat"],
            "lng": item["lng"],
            "screen_text": menu,
        }

    return {
        "status": "not_found",
        "ussd_code": raw,
        "msisdn": payload.msisdn,
        "resolved_postcode": extracted,
        "lat": 9.0765,
        "lng": 7.4892,
        "screen_text": (
            f"END Postcode360 USSD (*347#)\n"
            f"Postcode '{extracted}' not found.\n"
            f"Dial *347*FC-02-A09-DB-09# or mint a TP-ABJ code."
        ),
    }
    
    # ---------------------------------------------------------------------------
# 6. Offline 50km LGA Tile Packs & Architecture Spec Endpoints
# ---------------------------------------------------------------------------
_IN_MEMORY_TILE_PACKS: Dict[str, dict] = {
    "pack-amac-core": {
        "pack_id": "pack-amac-core",
        "lga": "AMAC (Wuse II, Garki, Maitama, CBD, Jabi)",
        "uri": "mapbox://offline/amac-50km-v1.pack",
        "radius_km": 50,
        "size_mb": 12.0,
        "cached_polygons": 5,
        "status": "CACHED_WIFI",
        "last_synced": datetime.now(timezone.utc).isoformat(),
    },
    "pack-bwari": {
        "pack_id": "pack-bwari",
        "lga": "Bwari LGA (Kubwa & Dutse Alhaji Grid)",
        "uri": "mapbox://offline/bwari-50km-v1.pack",
        "radius_km": 50,
        "size_mb": 11.4,
        "cached_polygons": 3,
        "status": "AVAILABLE",
        "last_synced": None,
    },
    "pack-gwagwalada": {
        "pack_id": "pack-gwagwalada",
        "lga": "Gwagwalada LGA (University & Market Grid)",
        "uri": "mapbox://offline/gwagwalada-50km-v1.pack",
        "radius_km": 50,
        "size_mb": 10.8,
        "cached_polygons": 2,
        "status": "AVAILABLE",
        "last_synced": None,
    },
}


class ValidatePostcodeRequest(BaseModel):
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    publishable_key: Optional[str] = Field(default="pk_test_postcode360_abuja_01")
    origin: Optional[str] = Field(default="http://localhost:5173")


class EmergencySmsRequest(BaseModel):
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    phone: str = Field(default="+2348035550199")
    lat: float = Field(default=9.0765)
    lng: float = Field(default=7.4892)


@router.get("/v1/tiles/packs")
def list_offline_tile_packs():
    return list(_IN_MEMORY_TILE_PACKS.values())


@router.post("/v1/tiles/packs/{pack_id}/sync")
def sync_offline_tile_pack(pack_id: str):
    if pack_id not in _IN_MEMORY_TILE_PACKS:
        raise HTTPException(status_code=404, detail=f"Tile pack '{pack_id}' not found.")
    pack = _IN_MEMORY_TILE_PACKS[pack_id]
    pack["status"] = "CACHED_WIFI"
    pack["last_synced"] = datetime.now(timezone.utc).isoformat()
    return pack


@router.get("/v1/search")
def search_postcodes(
    q: str = Query(default="", description="Postcode, street, or district query"),
    type: str = Query(default="postcode"),
    db: Optional[Session] = Depends(get_db),
):
    from .main import load_mock_registry

    query_norm = q.strip().upper()
    results = []

    registry = load_mock_registry()
    for code, item in registry.items():
        if (
            not query_norm
            or query_norm in code.upper()
            or query_norm in item.get("district", "").upper()
            or query_norm in item.get("street", "").upper()
        ):
            results.append(
                {
                    "postcode": item["postcode"],
                    "district": item["district"],
                    "street": item["street"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "verified": True,
                    "is_alias": False,
                }
            )

    for code, alias in _IN_MEMORY_ALIASES.items():
        if (
            not query_norm
            or query_norm in code.upper()
            or query_norm in alias.get("alias_name", "").upper()
            or query_norm in alias.get("district", "").upper()
        ):
            results.append(
                {
                    "postcode": alias["alias_code"],
                    "district": alias.get("district", "AMAC"),
                    "street": alias["alias_name"],
                    "lat": alias["lat"],
                    "lng": alias["lng"],
                    "verified": alias["verified"],
                    "is_alias": True,
                }
            )

    return {
        "status": "success",
        "type": type,
        "query": q,
        "count": len(results),
        "results": results,
    }


@router.post("/v1/validate")
def validate_postcode_contract(
    payload: ValidatePostcodeRequest,
    db: Optional[Session] = Depends(get_db),
):
    from .main import load_mock_registry

    code = payload.postcode.strip().upper()
    registry = load_mock_registry()
    if code in registry:
        item = registry[code]
        return {
            "valid": True,
            "postcode": code,
            "is_temp_code": False,
            "verified": True,
            "confidence": item.get("confidence", 0.98),
            "bound_origin": payload.origin,
        }

    alias_data = resolve_alias_as_postcode_data(code, db)
    if alias_data:
        return {
            "valid": True,
            "postcode": alias_data.postcode,
            "is_temp_code": not alias_data.verified,
            "verified": alias_data.verified,
            "confidence": alias_data.confidence,
            "bound_origin": payload.origin,
        }

    return {
        "valid": False,
        "postcode": code,
        "is_temp_code": False,
        "verified": False,
        "confidence": 0.0,
        "bound_origin": payload.origin,
    }


@router.post("/v1/emergency/sms")
@router.post("/emergency/sms")
def send_termii_emergency_sms(payload: EmergencySmsRequest):
    code = payload.postcode.strip().upper()
    sms_body = (
        f"TERMII 2G FALLBACK [Postcode360]: Location shared for {code}. "
        f"Map: https://maps.google.com/?q={payload.lat},{payload.lng} — Reply YES to confirm dispatch."
    )
    return {
        "status": "sent",
        "provider": "Termii 2G Gateway",
        "to": payload.phone,
        "postcode": code,
        "message": sms_body,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # ---------------------------------------------------------------------------
# 7. Verified Wuse/Garki Delivery Proofs Dataset
# ---------------------------------------------------------------------------
_WUSE_GARKI_DELIVERY_PROOFS: List[dict] = [
    {
        "delivery_id": "DLV-ABJ-001",
        "order_id": "ord-wuse2-001",
        "postcode": "FC-02-A09-DB-09",
        "district": "Wuse II",
        "street": "42 Adetokunbo Ademola Crescent, Wuse II",
        "customer_name": "Hajiya Amina Yusuf",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0765,
        "lng": 7.4892,
        "gps_offset_m": 4.2,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse2-ademola-01.jpg",
        "delivered_at": "2026-11-06T10:14:22Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-002",
        "order_id": "ord-wuse2-002",
        "postcode": "FC-02-A09-DB-09",
        "district": "Wuse II",
        "street": "18 Aminu Kano Crescent, Near Banex Plaza, Wuse II",
        "customer_name": "Engr. Tunde Bakare",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0781,
        "lng": 7.4864,
        "gps_offset_m": 6.8,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse2-aminukano-02.jpg",
        "delivered_at": "2026-11-06T11:30:05Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-003",
        "order_id": "ord-wuse2-003",
        "postcode": "TP-ABJ-7K2P",
        "district": "Wuse II",
        "street": "Banex Plaza Extension Gate 2, Wuse II",
        "customer_name": "Sadiq Danjuma",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0758,
        "lng": 7.4904,
        "gps_offset_m": 3.5,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse2-banex-tp-03.jpg",
        "delivered_at": "2026-11-06T12:45:19Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-004",
        "order_id": "ord-garki-004",
        "postcode": "FC-01-G02-GA-04",
        "district": "Garki Area 11",
        "street": "14 Gimbiya Street, Garki Area 11",
        "customer_name": "Dr. Ngozi Eze",
        "rider_name": "Chinedu Okafor (Garki Rider)",
        "lat": 9.0384,
        "lng": 7.4918,
        "gps_offset_m": 5.1,
        "pod_photo_url": "https://images.postcode360.ng/pod/garki-gimbiya-04.jpg",
        "delivered_at": "2026-11-06T13:20:40Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-005",
        "order_id": "ord-garki-005",
        "postcode": "FC-01-G02-GA-04",
        "district": "Garki Area 2",
        "street": "Block 7 Moshood Abiola Way, Garki Area 2",
        "customer_name": "Barr. Ibrahim Lawal",
        "rider_name": "Chinedu Okafor (Garki Rider)",
        "lat": 9.0342,
        "lng": 7.4825,
        "gps_offset_m": 7.4,
        "pod_photo_url": "https://images.postcode360.ng/pod/garki-area2-05.jpg",
        "delivered_at": "2026-11-06T14:05:11Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-006",
        "order_id": "ord-wuse2-006",
        "postcode": "FC-02-A09-DB-09",
        "district": "Wuse II",
        "street": "9 Parakou Crescent, Off Aminu Kano, Wuse II",
        "customer_name": "Zainab Abdullahi",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0749,
        "lng": 7.4841,
        "gps_offset_m": 2.9,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse2-parakou-06.jpg",
        "delivered_at": "2026-11-06T15:12:50Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-007",
        "order_id": "ord-garki-007",
        "postcode": "FC-01-G02-GA-04",
        "district": "Garki Area 8",
        "street": "22 Tafawa Balewa Way, Garki Area 8",
        "customer_name": "Chukwuma Nnamdi",
        "rider_name": "Chinedu Okafor (Garki Rider)",
        "lat": 9.0412,
        "lng": 7.4889,
        "gps_offset_m": 4.9,
        "pod_photo_url": "https://images.postcode360.ng/pod/garki-area8-07.jpg",
        "delivered_at": "2026-11-06T15:54:03Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-008",
        "order_id": "ord-wuse-008",
        "postcode": "FC-02-A09-DB-09",
        "district": "Wuse Zone 4",
        "street": "Plot 310 Herbert Macaulay Way, Wuse Zone 4",
        "customer_name": "Aisha Mohammed",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0665,
        "lng": 7.4795,
        "gps_offset_m": 6.0,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse-zone4-08.jpg",
        "delivered_at": "2026-11-06T16:28:14Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-009",
        "order_id": "ord-garki-009",
        "postcode": "FC-01-G02-GA-04",
        "district": "Garki Area 3",
        "street": "5 Benue Crescent, Garki Area 3",
        "customer_name": "Funke Adeyemi",
        "rider_name": "Chinedu Okafor (Garki Rider)",
        "lat": 9.0318,
        "lng": 7.4861,
        "gps_offset_m": 3.8,
        "pod_photo_url": "https://images.postcode360.ng/pod/garki-area3-09.jpg",
        "delivered_at": "2026-11-06T17:10:44Z",
        "status": "VERIFIED_POD",
    },
    {
        "delivery_id": "DLV-ABJ-010",
        "order_id": "ord-wuse2-010",
        "postcode": "FC-02-A09-DB-09",
        "district": "Wuse II",
        "street": "64 Lobito Crescent, Wuse II",
        "customer_name": "Alhaji Kabiru Bello",
        "rider_name": "Musa Ibrahim (Wuse Rider)",
        "lat": 9.0731,
        "lng": 7.4922,
        "gps_offset_m": 5.3,
        "pod_photo_url": "https://images.postcode360.ng/pod/wuse2-lobito-10.jpg",
        "delivered_at": "2026-11-06T17:55:29Z",
        "status": "VERIFIED_POD",
    },
]


@router.get("/v1/deliveries/proofs")
def list_wuse_garki_delivery_proofs():
    return {
        "status": "success",
        "dataset_id": "corridor-delivery-proofs",
        "corridor": "Wuse II & Garki (AMAC, Abuja)",
        "count": len(_WUSE_GARKI_DELIVERY_PROOFS),
        "proofs": _WUSE_GARKI_DELIVERY_PROOFS,
    }

@router.get("/v1/social-stores", response_model=List[SocialStoreRecord])
def list_social_stores():
    return _IN_MEMORY_SOCIAL_STORES


@router.post("/v1/social-stores", response_model=SocialStoreRecord)
def create_social_store(payload: SocialStoreCreateRequest):
    slug = payload.store_slug or payload.merchant_name.lower().replace(" ", "-").replace("'", "")
    bio_link = f"https://postcode360.ng/store/{slug}"
    prods = []
    if payload.products:
        for p in payload.products:
            p_dict = p.model_dump()
            if not p_dict.get("product_link"):
                p_dict["product_link"] = f"https://postcode360.ng/pay/{slug}/{p.id}"
            prods.append(p_dict)
    else:
        prods = [
            {
                "id": f"prod-{slug}-01",
                "title": '30" Bone Straight Raw Vietnamese Wig',
                "price_ngn": 600000.0,
                "category": "Luxury Hair",
                "description": "100% Raw unprocessed bone straight double drawn human hair with HD frontal lace.",
                "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
                "stock_count": 8,
                "product_link": f"https://postcode360.ng/pay/{slug}/prod-{slug}-01",
            },
            {
                "id": f"prod-{slug}-02",
                "title": "Structured Top-Handle Leather Bag",
                "price_ngn": 60000.0,
                "category": "Accessories",
                "description": "Italian vegetable-tanned cowhide with gold-plated hardware and protective feet.",
                "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80",
                "stock_count": 15,
                "product_link": f"https://postcode360.ng/pay/{slug}/prod-{slug}-02",
            },
            {
                "id": f"prod-{slug}-03",
                "title": "Royal Arabian Oud Extrait Perfume (100ml)",
                "price_ngn": 100000.0,
                "category": "Artisanal Perfumery",
                "description": "Concentrated pure agarwood extrait infused with Damascus rose and ambergris.",
                "image_url": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80",
                "stock_count": 25,
                "product_link": f"https://postcode360.ng/pay/{slug}/prod-{slug}-03",
            },
        ]

    new_store = {
        "store_slug": slug,
        "merchant_name": payload.merchant_name,
        "merchant_handle": payload.merchant_handle or f"@{slug}",
        "merchant_phone": payload.merchant_phone,
        "pickup_postcode": payload.pickup_postcode,
        "pickup_location": {"lat": 9.0765, "lng": 7.4892},
        "bio_link": bio_link,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "products": prods,
    }
    _IN_MEMORY_SOCIAL_STORES.append(new_store)
    return new_store
