from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LookupRequest(BaseModel):
    code: str = Field(..., examples=["FC-02-A09-DB-09"], description="NIPOST postcode or temporary alias code")
    force_mock: Optional[bool] = Field(
        default=None,
        description="Override environment toggle to force local Abuja sandbox resolution without rate limits",
    )


class PostcodeData(BaseModel):
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    formatted: str = Field(..., examples=["FC 02 A09 DB 09"])
    state: str = Field(..., examples=["Federal Capital Territory"])
    lga: str = Field(..., examples=["AMAC"])
    district: Optional[str] = Field(default=None, examples=["Wuse II"])
    street: Optional[str] = Field(default=None, examples=["Adetokunbo Ademola Crescent"])
    lat: float = Field(..., examples=[9.0765])
    lng: float = Field(..., examples=[7.4892])
    building_polygon: Optional[List[List[float]]] = Field(
        default=None,
        examples=[[[7.4891, 9.0764], [7.4893, 9.0764], [7.4893, 9.0766], [7.4891, 9.0766], [7.4891, 9.0764]]],
    )
    confidence: float = Field(default=0.98, examples=[0.98])
    verified: bool = Field(default=True, examples=[True])
    is_alias: bool = Field(default=False, examples=[False])


class LookupResponse(BaseModel):
    status: str = Field(default="success", examples=["success"])
    source: str = Field(..., examples=["postgis_db", "mock_cache", "nipost_upstream"])
    latency_ms: float = Field(..., examples=[24.2])
    data: PostcodeData


class WidgetSessionRequest(BaseModel):
    publishable_key: str = Field(
        default="pk_test_findam_abuja_01",
        examples=["pk_test_findam_abuja_01"],
        description="Origin-bound merchant publishable key",
    )
    nin: Optional[str] = Field(
        default=None,
        examples=["12345678901"],
        description="11-digit Nigerian National Identification Number (hashed server-side, never stored in plain text)",
    )
    email: Optional[str] = Field(
        default=None,
        examples=["customer@findam.ng"],
        description="Customer email address (hashed server-side if NIN is not provided)",
    )


class WidgetSessionResponse(BaseModel):
    status: str = Field(default="success", examples=["success"])
    session_token: str = Field(..., description="Origin-bound JWT with HMAC-SHA256 hashed subject")
    token_type: str = Field(default="Bearer", examples=["Bearer"])
    expires_in: int = Field(default=1800, examples=[1800])
    bound_origin: str = Field(..., examples=["http://localhost:3000"])
    identity_type: str = Field(..., examples=["nin", "email"])
    subject_hash: str = Field(..., examples=["sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"])


class OrderCreateRequest(BaseModel):
    idempotency_key: str = Field(
        ...,
        examples=["ord-wuse2-2026-001"],
        description="Unique client key to prevent duplicate order charges on network retries",
    )
    postcode: str = Field(
        ...,
        examples=["FC-02-A09-DB-09"],
        description="Destination NIPOST postcode or alias",
    )
    customer_name: Optional[str] = Field(default="Hajiya Amina", examples=["Hajiya Amina"])
    customer_phone: Optional[str] = Field(default="+2348030001122", examples=["+2348030001122"])
    amount_ngn: Optional[float] = Field(default=15500.0, examples=[15500.0])
    notes: Optional[str] = Field(default="Blue gate beside pharmacy", examples=["Blue gate beside pharmacy"])


class OrderResponse(BaseModel):
    status: str = Field(default="success", examples=["success"])
    idempotent_replay: bool = Field(
        default=False,
        description="True if this order was already created with the same idempotency_key (double-charge prevented)",
    )
    order_id: str = Field(..., examples=["b4a1c2d3-e4f5-6789-abcd-ef0123456789"])
    idempotency_key: str = Field(..., examples=["ord-wuse2-2026-001"])
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    delivery_address: str = Field(..., examples=["Adetokunbo Ademola Crescent, Wuse II, AMAC"])
    lat: float = Field(..., examples=[9.0765])
    lng: float = Field(..., examples=[7.4892])
    building_polygon: Optional[List[List[float]]] = None
    order_status: str = Field(default="PENDING", examples=["PENDING"])


class NearestItem(BaseModel):
    id: str
    name: str
    category_or_status: str
    phone: Optional[str] = None
    lat: float
    lng: float
    distance_meters: float


class NearestSearchResponse(BaseModel):
    status: str = Field(default="success", examples=["success"])
    source: str = Field(..., examples=["postgis_gist_knn", "mock_fallback"])
    search_center: Dict[str, float]
    radius_meters: float
    count: int
    results: List[NearestItem]
