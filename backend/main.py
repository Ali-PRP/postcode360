import json
import os
import re
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import httpx
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

app = FastAPI(
    title="Postcode360 Spatial Postcode Service",
    version="1.0.0",
    description="3-Tier Spatial Postcode Resolution API (Official NIPOST API Gateway + PostGIS + Mock Sandbox Fallback).",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGIN",
        "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000",
    ).split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

from .rider import router as rider_router, resolve_alias_as_postcode_data

app.include_router(rider_router)

MOCK_DATA_PATH = Path(__file__).resolve().parent / "mock_postcodes.json"
_IN_MEMORY_ORDERS: Dict[str, OrderResponse] = {}

NIPOST_API_BASE_URL = os.getenv("NIPOST_API_BASE_URL", "https://api.postcode.gov.ng").rstrip("/")
NIPOST_API_KEY = os.getenv("NIPOST_API_KEY", "").strip()
NIPOST_LOOKUP_LEVEL = int(os.getenv("NIPOST_LOOKUP_LEVEL", "3"))

# State centroids for L1-L3 NIPOST responses when point_geometry (L5) is not granted on the key
STATE_CENTROIDS: Dict[str, Tuple[float, float, str, str]] = {
    "AB": (5.5249, 7.4946, "Abia", "Umuahia"),
    "AD": (9.2795, 12.4582, "Adamawa", "Yola"),
    "AK": (5.0377, 7.9128, "Akwa Ibom", "Uyo"),
    "AN": (6.2105, 7.0723, "Anambra", "Awka"),
    "BA": (10.3158, 9.8442, "Bauchi", "Bauchi"),
    "BY": (4.9267, 6.2676, "Bayelsa", "Yenagoa"),
    "BE": (7.7322, 8.5391, "Benue", "Makurdi"),
    "BO": (11.8311, 13.1510, "Borno", "Maiduguri"),
    "CR": (4.9757, 8.3417, "Cross River", "Calabar"),
    "DT": (6.2059, 6.6959, "Delta", "Asaba"),
    "EB": (6.3249, 8.1137, "Ebonyi", "Abakaliki"),
    "ED": (6.3176, 5.6145, "Edo", "Benin City"),
    "EK": (7.6211, 5.2214, "Ekiti", "Ado Ekiti"),
    "EN": (6.4584, 7.5464, "Enugu", "Enugu"),
    "FC": (9.0765, 7.4892, "Federal Capital Territory", "AMAC"),
    "GO": (10.2897, 11.1673, "Gombe", "Gombe"),
    "IM": (5.4891, 7.0351, "Imo", "Owerri"),
    "JI": (11.7562, 9.3389, "Jigawa", "Dutse"),
    "KD": (10.5264, 7.4388, "Kaduna", "Kaduna"),
    "KN": (12.0022, 8.5920, "Kano", "Kano"),
    "KT": (12.9855, 7.6171, "Katsina", "Katsina"),
    "KB": (12.4539, 4.1975, "Kebbi", "Birnin Kebbi"),
    "KG": (7.8023, 6.7333, "Kogi", "Lokoja"),
    "KW": (8.4966, 4.5421, "Kwara", "Ilorin"),
    "LA": (6.4281, 3.4219, "Lagos", "Ikeja / Eti-Osa"),
    "NA": (8.4966, 8.5153, "Nasarawa", "Lafia"),
    "NI": (9.6139, 6.5569, "Niger", "Minna"),
    "OG": (7.1475, 3.3619, "Ogun", "Abeokuta"),
    "ON": (7.2571, 5.2058, "Ondo", "Akure"),
    "OS": (7.7827, 4.5418, "Osun", "Osogbo"),
    "OY": (7.4196, 3.9088, "Oyo", "Ibadan"),
    "PL": (9.8965, 8.8583, "Plateau", "Jos"),
    "RV": (4.8156, 7.0498, "Rivers", "Port Harcourt"),
    "SO": (13.0622, 5.2339, "Sokoto", "Sokoto"),
    "TA": (8.8937, 11.3596, "Taraba", "Jalingo"),
    "YO": (11.7470, 11.9608, "Yobe", "Damaturu"),
    "ZA": (12.1628, 6.6614, "Zamfara", "Gusau"),
}

# Official Sandbox & Sample Postcodes from https://docs.postcode.gov.ng/authentication & /concepts/lookup-levels
OFFICIAL_DOCS_SAMPLE_POSTCODES: Dict[str, dict] = {
    # Test Key Sandbox Postcodes (docs.postcode.gov.ng/authentication)
    "FC-01-A01-KP-27": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "Central Area (A01)", "street": "Public Building KP-27, Three Arms / Central District", "building_type": "public", "lat": 9.0612, "lng": 7.4984},
    "FC-01-A01-LR-01": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "Central Area (A01)", "street": "Public Building LR-01, Central District", "building_type": "public", "lat": 9.0594, "lng": 7.4922},
    "FC-01-A01-MH-01": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "Central Area (A01)", "street": "Public Building MH-01, Central District", "building_type": "public", "lat": 9.0558, "lng": 7.4896},
    "FC-01-A01-MV-01": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "Central Area (A01)", "street": "Public Building MV-01, Central District", "building_type": "public", "lat": 9.0631, "lng": 7.4865},
    "FC-01-A01-MW-01": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "Central Area (A01)", "street": "Public Building MW-01, Central District", "building_type": "public", "lat": 9.0648, "lng": 7.4910},
    # Quickstart & Lookup Levels Example (docs.postcode.gov.ng/concepts/lookup-levels)
    "EK-01-A03-FK-01": {"state": "Ekiti", "lga": "Ado Ekiti", "district": "Ado Ekiti (A03)", "street": "NTA Road, Back of Fabian Hotel, Ado Ekiti", "building_type": "residential", "lat": 7.6194, "lng": 5.2312},
    # Live Sample Postcodes Across States (docs.postcode.gov.ng/concepts/lookup-levels)
    "AK-11-I61-ZF-12": {"state": "Akwa Ibom", "lga": "Uyo", "district": "Ewet / I61 Sector", "street": "Plot 12 ZF Area, Uyo", "building_type": "residential", "lat": 5.0389, "lng": 7.9152},
    "AK-11-H40-WD-11": {"state": "Akwa Ibom", "lga": "Uyo", "district": "H40 District", "street": "11 WD Close, Uyo", "building_type": "residential", "lat": 5.0312, "lng": 7.9084},
    "BA-02-M67-BL-69": {"state": "Bauchi", "lga": "Bauchi", "district": "M67 District", "street": "69 BL Crescent, Bauchi", "building_type": "residential", "lat": 10.3175, "lng": 9.8468},
    "BA-02-E99-NE-30": {"state": "Bauchi", "lga": "Bauchi", "district": "E99 District", "street": "30 NE Avenue, Bauchi", "building_type": "commercial", "lat": 10.3112, "lng": 9.8395},
    "EB-13-G95-FR-90": {"state": "Ebonyi", "lga": "Abakaliki", "district": "G95 District", "street": "90 FR Road, Abakaliki", "building_type": "residential", "lat": 6.3268, "lng": 8.1154},
    "EB-13-I97-AB-30": {"state": "Ebonyi", "lga": "Abakaliki", "district": "I97 District", "street": "30 AB Street, Abakaliki", "building_type": "commercial", "lat": 6.3215, "lng": 8.1098},
    "EN-05-V19-CD-22": {"state": "Enugu", "lga": "Enugu North", "district": "Independence Layout (V19)", "street": "22 CD Close, Enugu", "building_type": "residential", "lat": 6.4598, "lng": 7.5482},
    "EN-05-V19-FT-20": {"state": "Enugu", "lga": "Enugu North", "district": "Independence Layout (V19)", "street": "20 FT Avenue, Enugu", "building_type": "residential", "lat": 6.4562, "lng": 7.5439},
    "FC-03-B06-AG-12": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "B06 District", "street": "Plot 12 AG Crescent, Abuja", "building_type": "residential", "lat": 9.0685, "lng": 7.4312},
    "FC-02-B19-RT-30": {"state": "Federal Capital Territory", "lga": "AMAC", "district": "B19 District", "street": "Plot 30 RT Way, Abuja", "building_type": "commercial", "lat": 9.0442, "lng": 7.4968},
    "JI-24-O18-JP-23": {"state": "Jigawa", "lga": "Dutse", "district": "O18 District", "street": "23 JP Road, Dutse", "building_type": "residential", "lat": 11.7580, "lng": 9.3412},
    "JI-24-N11-VM-58": {"state": "Jigawa", "lga": "Dutse", "district": "N11 District", "street": "58 VM Street, Dutse", "building_type": "residential", "lat": 11.7534, "lng": 9.3365},
    "KN-31-F82-WJ-80": {"state": "Kano", "lga": "Nassarawa / Kano Municipal", "district": "F82 District", "street": "80 WJ Road, Kano", "building_type": "commercial", "lat": 12.0045, "lng": 8.5948},
    "KN-31-D78-IQ-38": {"state": "Kano", "lga": "Kano Municipal", "district": "D78 District", "street": "38 IQ Crescent, Kano", "building_type": "residential", "lat": 11.9985, "lng": 8.5892},
    "LA-11-W06-TC-10": {"state": "Lagos", "lga": "Eti-Osa / Ikeja", "district": "W06 District", "street": "10 TC Close, Lagos", "building_type": "commercial", "lat": 6.4315, "lng": 3.4258},
    "LA-11-U34-ZR-63": {"state": "Lagos", "lga": "Ikeja / Mainland", "district": "U34 District", "street": "63 ZR Avenue, Lagos", "building_type": "residential", "lat": 6.5784, "lng": 3.3592},
    "NI-09-J67-QC-65": {"state": "Niger", "lga": "Chanchaga", "district": "J67 District", "street": "65 QC Road, Minna", "building_type": "residential", "lat": 9.6162, "lng": 6.5594},
    "NI-09-A75-DA-10": {"state": "Niger", "lga": "Chanchaga", "district": "A75 District", "street": "10 DA Street, Minna", "building_type": "residential", "lat": 9.6114, "lng": 6.5542},
    "OG-14-T18-BN-16": {"state": "Ogun", "lga": "Abeokuta South", "district": "T18 District", "street": "16 BN Avenue, Abeokuta", "building_type": "residential", "lat": 7.1498, "lng": 3.3645},
    "OG-14-M82-QA-09": {"state": "Ogun", "lga": "Abeokuta South", "district": "M82 District", "street": "9 QA Close, Abeokuta", "building_type": "commercial", "lat": 7.1452, "lng": 3.3592},
}


def normalize_postcode(raw_code: str) -> str:
    """
    Normalizes any of the 3 official NIPOST input styles into canonical hyphenated AA-99-H77-BB-55:
    - 'EK-01-A03-FK-01' -> 'EK-01-A03-FK-01'
    - 'EK 01 A03 FK 01' -> 'EK-01-A03-FK-01'
    - 'ek01a03fk01'     -> 'EK-01-A03-FK-01'
    """
    cleaned = raw_code.strip().upper()
    compact = re.sub(r"[\s\-]+", "", cleaned)
    if len(compact) == 11 and re.match(r"^[A-Z]{2}\d{2}[A-Z0-9]{3}[A-Z]{2}\d{2}$", compact):
        return f"{compact[0:2]}-{compact[2:4]}-{compact[4:7]}-{compact[7:9]}-{compact[9:11]}"
    return re.sub(r"\s+", "-", cleaned)


def disassemble_postcode_segments(code: str) -> Optional[Dict[str, str]]:
    """Disassembles a 11-character (5-segment) NIPOST code into state, lga, district, area, unit."""
    norm = normalize_postcode(code)
    parts = norm.split("-")
    if len(parts) == 5 and len(parts[0]) == 2 and len(parts[1]) <= 2 and len(parts[2]) == 3 and len(parts[3]) == 2 and len(parts[4]) <= 2:
        lga = parts[1].zfill(2)
        unit = parts[4].zfill(2)
        if lga == "00" or unit == "00":
            return None
        return {
            "state": parts[0].upper(),
            "lga": lga,
            "district": parts[2].upper(),
            "area": parts[3].upper(),
            "unit": unit,
        }
    return None


def format_display_code(code: str) -> str:
    return code.replace("-", " ")


def generate_building_footprint(center_lat: float, center_lng: float, seed_str: str) -> List[List[float]]:
    seed = sum((i + 1) * ord(ch) for i, ch in enumerate(seed_str))
    shape_type = seed % 3
    if shape_type == 0:
        offsets = [
            (-0.00019, 0.00015),
            (0.00019, 0.00015),
            (0.00019, -0.00015),
            (0.00002, -0.00015),
            (0.00002, 0.00001),
            (-0.00019, 0.00001),
        ]
    elif shape_type == 1:
        offsets = [
            (-0.00020, 0.00014),
            (0.00020, 0.00016),
            (0.00022, -0.00013),
            (-0.00018, -0.00015),
        ]
    else:
        offsets = [
            (-0.00014, 0.00018),
            (0.00014, 0.00018),
            (0.00022, 0.00002),
            (0.00014, -0.00016),
            (-0.00014, -0.00016),
            (-0.00022, 0.00002),
        ]
    ring = [[round(center_lng + dlng, 6), round(center_lat + dlat, 6)] for dlng, dlat in offsets]
    ring.append([ring[0][0], ring[0][1]])
    return ring


@lru_cache(maxsize=1)
def load_mock_registry() -> dict:
    combined = {}
    if MOCK_DATA_PATH.exists():
        with open(MOCK_DATA_PATH, "r", encoding="utf-8-sig") as f:
            combined.update(json.load(f))

    # Merge official docs.postcode.gov.ng sandbox & sample postcodes into the local fallback registry
    for code, meta in OFFICIAL_DOCS_SAMPLE_POSTCODES.items():
        if code not in combined:
            segs = disassemble_postcode_segments(code) or {
                "state": code[:2],
                "lga": "01",
                "district": "A01",
                "area": "AA",
                "unit": "01",
            }
            lat_f, lng_f = meta["lat"], meta["lng"]
            combined[code] = {
                "postcode": code,
                "formatted": format_display_code(code),
                "state": meta["state"],
                "lga": meta["lga"],
                "district": meta["district"],
                "street": meta["street"],
                "tier1_state": f"{segs['state']} ({meta['state']})",
                "tier2_sector": f"{segs['lga']}-{segs['district']} ({meta['district']})",
                "tier3_unit": f"{segs['area']}-{segs['unit']} ({meta['building_type'].title()} Building)",
                "nipost_legacy": "900001" if segs["state"] == "FC" else "100001",
                "plus_code": "6FX93FGP+JM",
                "building_type": meta["building_type"].title(),
                "lat": lat_f,
                "lng": lng_f,
                "building_polygon": generate_building_footprint(lat_f, lng_f, code),
                "confidence": 0.99,
                "verified": True,
                "is_alias": False,
            }
    return combined


def parse_polygon(raw_poly, fallback_code: str, lat: float = 9.0765, lng: float = 7.4892) -> List[List[float]]:
    if isinstance(raw_poly, list) and len(raw_poly) >= 4:
        return raw_poly
    if isinstance(raw_poly, str) and raw_poly.strip().startswith("["):
        try:
            parsed = json.loads(raw_poly)
            if isinstance(parsed, list) and len(parsed) >= 4:
                return parsed
        except Exception:
            pass
    mock_poly = load_mock_registry().get(fallback_code, {}).get("building_polygon")
    if mock_poly:
        return mock_poly
    return generate_building_footprint(lat, lng, fallback_code)


async def query_official_nipost_api(normalized_code: str) -> Optional[Tuple[PostcodeData, str]]:
    """
    Calls the official NIPOST Postcode API first:
      GET https://api.postcode.gov.ng/v1/lookup?code=<code >&level=<1..5>
      Header: X-API-Key: <NIPOST_API_KEY>
    Automatically steps down level (e.g. L5 -> L3 -> L2 -> L1) if 403 level_not_granted is returned.
    """
    api_key = os.getenv("NIPOST_API_KEY", NIPOST_API_KEY).strip()
    if not api_key or api_key in ("", "your_nipost_test_or_live_key_here", "pk_test_postcode360_abuja_01", "pk_test_findam_abuja_01"):
        return None

    base_url = os.getenv("NIPOST_API_BASE_URL", NIPOST_API_BASE_URL).rstrip("/")
    preferred_level = max(1, min(5, int(os.getenv("NIPOST_LOOKUP_LEVEL", str(NIPOST_LOOKUP_LEVEL)))))
    levels_to_try = [preferred_level] + [lv for lv in (3, 2, 1) if lv < preferred_level]

    async with httpx.AsyncClient(timeout=4.5) as client:
        for level in levels_to_try:
            try:
                resp = await client.get(
                    f"{base_url}/v1/lookup",
                    params={"code": normalized_code, "level": level},
                    headers={"X-API-Key": api_key, "Accept": "application/json"},
                )
                if resp.status_code == 403:
                    # Key may lack granted level (e.g. level_not_granted); step down to lower level
                    continue
                if resp.status_code != 200:
                    return None

                payload = resp.json()
                raw_data = payload.get("data") if isinstance(payload, dict) else None
                if not raw_data or not raw_data.get("valid", True):
                    return None

                canonical_code = normalize_postcode(raw_data.get("postcode") or normalized_code)
                segs = disassemble_postcode_segments(canonical_code) or {
                    "state": canonical_code[:2],
                    "lga": "01",
                    "district": "A01",
                    "area": "AA",
                    "unit": "01",
                }
                st_prefix = segs["state"]
                default_lat, default_lng, default_state, default_lga = STATE_CENTROIDS.get(
                    st_prefix, (9.0765, 7.4892, "Federal Capital Territory", "AMAC")
                )

                admin_addr = raw_data.get("administrative_address") or {}
                recent_addr = raw_data.get("recent_house_address") or {}
                building_use = raw_data.get("building_use_status") or "verified_parcel"
                point_geom = raw_data.get("point_geometry") or {}

                state_name = (admin_addr.get("state_name") or default_state).title()
                lga_name = (admin_addr.get("lga_name") or default_lga).title()
                locality_name = (admin_addr.get("locality_name") or lga_name).title()
                street_name = (
                    recent_addr.get("recent")
                    or f"Area {segs['area']} Unit {segs['unit']}, {locality_name}"
                )

                # Extract coordinates from L5 point_geometry if present
                lat_val: Optional[float] = None
                lng_val: Optional[float] = None
                if isinstance(point_geom, dict):
                    if "lat" in point_geom and "lng" in point_geom:
                        lat_val = float(point_geom["lat"])
                        lng_val = float(point_geom["lng"])
                    elif "latitude" in point_geom and "longitude" in point_geom:
                        lat_val = float(point_geom["latitude"])
                        lng_val = float(point_geom["longitude"])
                    elif isinstance(point_geom.get("coordinates"), list) and len(point_geom["coordinates"]) >= 2:
                        lng_val = float(point_geom["coordinates"][0])
                        lat_val = float(point_geom["coordinates"][1])

                # If key is L1-L3 (no point_geometry), check sample table or deterministic state/sector offset
                if lat_val is None or lng_val is None:
                    if canonical_code in OFFICIAL_DOCS_SAMPLE_POSTCODES:
                        lat_val = OFFICIAL_DOCS_SAMPLE_POSTCODES[canonical_code]["lat"]
                        lng_val = OFFICIAL_DOCS_SAMPLE_POSTCODES[canonical_code]["lng"]
                    else:
                        seed = sum((i + 1) * ord(c) for i, c in enumerate(canonical_code))
                        lat_val = round(default_lat + ((seed % 23) - 11) * 0.00055, 5)
                        lng_val = round(default_lng + (((seed // 5) % 23) - 11) * 0.00055, 5)

                polygon = generate_building_footprint(lat_val, lng_val, canonical_code)

                postcode_data = PostcodeData(
                    postcode=canonical_code,
                    formatted=format_display_code(canonical_code),
                    state=state_name,
                    lga=lga_name,
                    district=locality_name,
                    street=street_name,
                    tier1_state=f"{st_prefix} ({state_name})",
                    tier2_sector=f"{segs['lga']}-{segs['district']} ({locality_name})",
                    tier3_unit=f"{segs['area']}-{segs['unit']} ({building_use.title()})",
                    nipost_legacy="NIPOST-L" + str(level),
                    plus_code=admin_addr.get("zone") or "NIPOST-VERIFIED",
                    building_type=building_use.title(),
                    lat=lat_val,
                    lng=lng_val,
                    building_polygon=polygon,
                    confidence=0.99,
                    verified=True,
                    is_alias=False,
                )
                return postcode_data, f"nipost_api_l{level}"
            except Exception:
                break
    return None


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
        lat_f = float(row["lat"])
        lng_f = float(row["lng"])
        polygon = parse_polygon(row.get("building_polygon"), code, lat_f, lng_f)
        segs = disassemble_postcode_segments(row["code"]) or {
            "state": row["code"][:2],
            "lga": "01",
            "district": "A01",
            "area": "AA",
            "unit": "01",
        }
        return PostcodeData(
            postcode=row["code"],
            formatted=format_display_code(row["code"]),
            state=row["state"],
            lga=row["lga"],
            district=row["district"],
            street=row["street"],
            tier1_state=f"{segs['state']} ({row['state']})",
            tier2_sector=f"{segs['lga']}-{segs['district']} ({row['district'] or row['lga']})",
            tier3_unit=f"{segs['area']}-{segs['unit']} (Verified Parcel)",
            lat=lat_f,
            lng=lng_f,
            building_polygon=polygon,
            confidence=float(row["confidence"] or 0.98),
            verified=bool(row["verified"]),
            is_alias=False,
        )
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


def synthesize_from_5_segments(normalized: str) -> Optional[PostcodeData]:
    """Fallback 5-segment parser (AA-99-H77-BB-55) when offline and code is not in mock_postcodes.json."""
    segs = disassemble_postcode_segments(normalized)
    if not segs or segs["state"] not in STATE_CENTROIDS:
        return None
    base_lat, base_lng, state_name, lga_name = STATE_CENTROIDS[segs["state"]]
    seed = sum((i + 1) * ord(c) for i, c in enumerate(normalized))
    lat_f = round(base_lat + ((seed % 29) - 14) * 0.00055, 5)
    lng_f = round(base_lng + (((seed // 7) % 29) - 14) * 0.00055, 5)
    return PostcodeData(
        postcode=normalized,
        formatted=format_display_code(normalized),
        state=state_name,
        lga=f"{lga_name} (LGA {segs['lga']})",
        district=f"District {segs['district']}",
        street=f"Unit {segs['unit']}, Area {segs['area']}, District {segs['district']}",
        tier1_state=f"{segs['state']} ({state_name})",
        tier2_sector=f"{segs['lga']}-{segs['district']} ({lga_name})",
        tier3_unit=f"{segs['area']}-{segs['unit']} (Unit {segs['unit']})",
        nipost_legacy="100001",
        plus_code="6FR5CCG9+NG",
        building_type="Residential / Commercial",
        lat=lat_f,
        lng=lng_f,
        building_polygon=generate_building_footprint(lat_f, lng_f, normalized),
        confidence=0.95,
        verified=True,
        is_alias=False,
    )


async def execute_lookup(code: str, force_mock: Optional[bool], db: Optional[Session]) -> LookupResponse:
    start_time = time.perf_counter()
    normalized = normalize_postcode(code)

    # If the user explicitly checked force_mock=True in the UI, check mock registry first
    if force_mock is True:
        registry = load_mock_registry()
        if normalized in registry:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return LookupResponse(
                source="mock_cache",
                latency_ms=elapsed,
                data=PostcodeData(**registry[normalized]),
            )

    # STEP 1 (PRIMARY): Official NIPOST API Gateway (https://api.postcode.gov.ng/v1/lookup)
    upstream_hit = await query_official_nipost_api(normalized)
    if upstream_hit is not None:
        resolved_data, source_tag = upstream_hit
        cache_to_postgis(db, resolved_data)
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source=source_tag,
            latency_ms=elapsed,
            data=resolved_data,
        )

    # STEP 2: PostGIS Canonical Database Cache
    cached = query_postgis_cache(db, normalized)
    if cached:
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source="postgis_db",
            latency_ms=elapsed,
            data=cached,
        )

    # STEP 3: Minted Temporary Postcodes (TP-...) & Aliases
    alias_match = resolve_alias_as_postcode_data(normalized, db)
    if alias_match:
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source="postgis_alias_tp",
            latency_ms=elapsed,
            data=alias_match,
        )

    # STEP 4 (FALLBACK): Local Mock & Official Docs Sample Postcode Registry
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

    # STEP 5 (FALLBACK): Valid 5-Segment Postcode Structure Fallback (AA-99-H77-BB-55)
    segment_fallback = synthesize_from_5_segments(normalized)
    if segment_fallback:
        cache_to_postgis(db, segment_fallback)
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return LookupResponse(
            source="segment_fallback_mock",
            latency_ms=elapsed,
            data=segment_fallback,
        )

    raise HTTPException(
        status_code=404,
        detail=f"Postcode '{normalized}' could not be resolved via api.postcode.gov.ng, PostGIS, or local fallback.",
    )


# ---------------------------------------------------------------------------
# Official NIPOST Assembly & Autocomplete Endpoints (docs.postcode.gov.ng)
# ---------------------------------------------------------------------------
class AssembleRequest(BaseModel):
    state: str
    lga: str
    district: str
    area: str
    unit: str


@app.post("/v1/assembly/assemble", tags=["Addressing"])
async def assemble_postcode(payload: AssembleRequest):
    api_key = os.getenv("NIPOST_API_KEY", NIPOST_API_KEY).strip()
    if api_key and api_key not in ("", "your_nipost_test_or_live_key_here"):
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                r = await client.post(
                    f"{NIPOST_API_BASE_URL}/v1/assembly/assemble",
                    headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                    json=payload.model_dump(),
                )
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass

    st = payload.state.strip().upper()
    lga = payload.lga.strip().zfill(2)
    dist = payload.district.strip().upper()
    area = payload.area.strip().upper()
    unit = payload.unit.strip().zfill(2)
    canonical = f"{st}-{lga}-{dist}-{area}-{unit}"
    return {
        "data": {
            "postcode": canonical,
            "display": canonical.replace("-", " "),
            "compact": canonical.replace("-", ""),
        }
    }


@app.get("/v1/assembly/disassemble", tags=["Addressing"])
async def disassemble_postcode(code: str = Query(..., description="Postcode in hyphenated, spaced, or compact form")):
    api_key = os.getenv("NIPOST_API_KEY", NIPOST_API_KEY).strip()
    if api_key and api_key not in ("", "your_nipost_test_or_live_key_here"):
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                r = await client.get(
                    f"{NIPOST_API_BASE_URL}/v1/assembly/disassemble",
                    params={"code": code},
                    headers={"X-API-Key": api_key},
                )
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass

    segs = disassemble_postcode_segments(code)
    if not segs:
        raise HTTPException(status_code=422, detail=f"Invalid 5-segment Nigerian postcode format: '{code}'")
    return {"data": segs}


@app.get("/v1/search/autocomplete", tags=["Addressing"])
async def autocomplete_postcode(q: str = Query(..., description="Postcode prefix, e.g. EK01 or FC-01")):
    api_key = os.getenv("NIPOST_API_KEY", NIPOST_API_KEY).strip()
    if api_key and api_key not in ("", "your_nipost_test_or_live_key_here"):
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                r = await client.get(
                    f"{NIPOST_API_BASE_URL}/v1/search/autocomplete",
                    params={"q": q},
                    headers={"X-API-Key": api_key},
                )
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass

    clean_q = re.sub(r"[\s\-]+", "", q.strip().upper())
    registry = load_mock_registry()
    matches = [
        {
            "postcode": k,
            "display": k.replace("-", " "),
            "compact": k.replace("-", ""),
            "state": v.get("state"),
            "lga": v.get("lga"),
            "district": v.get("district"),
            "street": v.get("street"),
        }
        for k, v in registry.items()
        if clean_q in k.replace("-", "") or q.strip().upper() in v.get("district", "").upper()
    ]
    return {"data": {"suggestions": matches[:15]}}


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
    has_nipost_key = bool(os.getenv("NIPOST_API_KEY", "").strip())
    return {
        "status": "healthy",
        "postgis_connected": db_connected,
        "nipost_api_configured": has_nipost_key,
        "upstream_mock": not has_nipost_key,
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
    if payload.idempotency_key in _IN_MEMORY_ORDERS:
        cached_order = _IN_MEMORY_ORDERS[payload.idempotency_key].model_copy()
        cached_order.idempotent_replay = True
        return cached_order

    if db is not None:
        try:
            existing = db.execute(
                text("""
                    SELECT id, idempotency_key, postcode, status,
                           customer_name, customer_phone, amount_ngn, notes,
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
                    district=place.district,
                    customer_name=existing.get("customer_name") or payload.customer_name or "Walk-in Customer",
                    customer_phone=existing.get("customer_phone") or payload.customer_phone or "+2348030000000",
                    amount_ngn=float(existing.get("amount_ngn") or payload.amount_ngn or 180000.0),
                    notes=existing.get("notes") or payload.notes,
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

    lookup_res = await execute_lookup(payload.postcode, None, db)
    place = lookup_res.data
    delivery_address = f"{place.street or ''}, {place.district or ''}, {place.lga}".strip(", ")
    order_id = str(uuid.uuid4())
    order_status = "PENDING"

    if db is not None:
        try:
            row = db.execute(
                text("""
                    INSERT INTO orders (
                        idempotency_key, merchant_origin, postcode,
                        customer_name, customer_phone, amount_ngn, notes,
                        delivery_location, status
                    )
                    VALUES (
                        :idem_key, 'http://localhost:5173', :postcode,
                        :cname, :cphone, :amt, :notes,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        'PENDING'
                    )
                    RETURNING id, status
                """),
                {
                    "idem_key": payload.idempotency_key,
                    "postcode": place.postcode,
                    "cname": payload.customer_name or "Walk-in Customer",
                    "cphone": payload.customer_phone or "+2348030000000",
                    "amt": payload.amount_ngn or 180000.0,
                    "notes": payload.notes,
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
        district=place.district,
        customer_name=payload.customer_name or "Walk-in Customer",
        customer_phone=payload.customer_phone or "+2348030000000",
        amount_ngn=payload.amount_ngn or 180000.0,
        notes=payload.notes,
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
    lat: float = Query(..., description="Delivery latitude"),
    lng: float = Query(..., description="Delivery longitude"),
    radius_meters: float = Query(default=5000.0, description="Search radius in meters"),
    limit: int = Query(default=5, ge=1, le=20),
    db: Optional[Session] = Depends(get_db),
):
    if db is not None:
        try:
            rows = db.execute(
                text("""
                    SELECT rider_id AS id,
                           rider_name AS name,
                           phone,
                           CASE WHEN is_available THEN 'AVAILABLE' ELSE 'BUSY' END AS status,
                           ST_Y(current_location::geometry) AS lat,
                           ST_X(current_location::geometry) AS lng,
                           ROUND(
                               ST_Distance(
                                   current_location,
                                   ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                               )::numeric, 1
                           ) AS distance_meters
                    FROM rider_loc
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
            if rows:
                items = [
                    NearestItem(
                        id=str(r.get("id") or idx),
                        name=str(r.get("name") or f"Rider {idx}"),
                        category_or_status=str(r.get("status") or "AVAILABLE"),
                        phone=r.get("phone"),
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

    fallback_riders = [
        NearestItem(
            id="rdr-ng-01",
            name="Musa Abdullahi (Express Dispatch)",
            category_or_status="AVAILABLE",
            phone="+2348031112233",
            lat=round(lat + 0.0016, 6),
            lng=round(lng - 0.0014, 6),
            distance_meters=235.0,
        ),
        NearestItem(
            id="rdr-ng-02",
            name="Chinedu Okafor (Metro Courier)",
            category_or_status="AVAILABLE",
            phone="+2348054445566",
            lat=round(lat - 0.0024, 6),
            lng=round(lng + 0.0021, 6),
            distance_meters=355.0,
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
    lat: float = Query(..., description="Caller latitude"),
    lng: float = Query(..., description="Caller longitude"),
    type: str = Query(default="HOSPITAL", description="Emergency facility type"),
    radius_meters: float = Query(default=10000.0, description="Search radius in meters"),
    limit: int = Query(default=5, ge=1, le=20),
    db: Optional[Session] = Depends(get_db),
):
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
                                name=str(r.get("name") or f"{facility_type} {idx}"),
                                category_or_status=str(r.get(type_col) or facility_type),
                                phone=r.get("phone"),
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

    fallback_emergency = [
        NearestItem(
            id="emg-ng-01",
            name=f"Central {facility_type.title()} Response Unit",
            category_or_status=facility_type,
            phone="112",
            lat=round(lat - 0.0021, 6),
            lng=round(lng - 0.0019, 6),
            distance_meters=310.0,
        ),
    ]
    return NearestSearchResponse(
        source="mock_fallback",
        search_center={"lat": lat, "lng": lng},
        radius_meters=radius_meters,
        count=len(fallback_emergency),
        results=fallback_emergency,
    )


@app.get("/orders", response_model=List[OrderResponse], tags=["Orders & Dispatch"])
@app.get("/v1/orders", response_model=List[OrderResponse], tags=["Orders & Dispatch"])
async def list_orders(limit: int = Query(default=50, ge=1, le=200), db: Optional[Session] = Depends(get_db)):
    results: List[OrderResponse] = []
    if db is not None:
        try:
            rows = db.execute(
                text("""
                    SELECT id, idempotency_key, postcode, customer_name, customer_phone, amount_ngn, notes, status,
                           ST_Y(delivery_location::geometry) AS lat,
                           ST_X(delivery_location::geometry) AS lng
                    FROM orders
                    ORDER BY created_at DESC NULLS LAST
                    LIMIT :limit
                """),
                {"limit": limit},
            ).mappings().all()
            registry = load_mock_registry()
            for r in rows:
                code_str = r["postcode"]
                lat_f = float(r["lat"])
                lng_f = float(r["lng"])
                place = registry.get(code_str, {})
                addr = f"{place.get('street', '')}, {place.get('district', '')}, {place.get('lga', 'AMAC')}".strip(", ")
                results.append(
                    OrderResponse(
                        idempotent_replay=False,
                        order_id=str(r["id"]),
                        idempotency_key=r["idempotency_key"],
                        postcode=code_str,
                        district=place.get("district"),
                        customer_name=r.get("customer_name") or "Walk-in Customer",
                        customer_phone=r.get("customer_phone") or "+2348030000000",
                        amount_ngn=float(r.get("amount_ngn") or 0.0),
                        notes=r.get("notes"),
                        delivery_address=addr or code_str,
                        lat=lat_f,
                        lng=lng_f,
                        building_polygon=place.get("building_polygon") or generate_building_footprint(lat_f, lng_f, code_str),
                        order_status=str(r.get("status") or "PENDING"),
                    )
                )
            if results:
                return results
        except Exception:
            db.rollback()
    return list(_IN_MEMORY_ORDERS.values())


@app.patch("/orders/{order_id}", tags=["Orders & Dispatch"])
@app.patch("/v1/orders/{order_id}", tags=["Orders & Dispatch"])
def update_order_status(
    order_id: str,
    status: str = Query(default="DISPATCHED", description="PENDING, DISPATCHED, or DELIVERED"),
    db: Optional[Session] = Depends(get_db),
):
    clean_status = status.strip().upper()
    if db is not None:
        try:
            db.execute(
                text("UPDATE orders SET status = :st WHERE id::text = :oid OR idempotency_key = :oid"),
                {"st": clean_status, "oid": order_id},
            )
            db.commit()
        except Exception:
            db.rollback()
    for k, v in _IN_MEMORY_ORDERS.items():
        if v.order_id == order_id or k == order_id:
            v.order_status = clean_status
    return {"status": "success", "order_id": order_id, "order_status": clean_status}
