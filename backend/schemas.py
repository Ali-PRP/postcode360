from typing import List, Optional
from pydantic import BaseModel, Field

class LookupRequest(BaseModel):
    code: str = Field(..., examples=["FC-02-A09-DB-09"])
    force_mock: Optional[bool] = None

class PostcodeData(BaseModel):
    postcode: str
    formatted: str
    state: str
    lga: str
    district: Optional[str] = None
    street: Optional[str] = None
    tier1_state: Optional[str] = "FC (FCT Abuja)"
    tier2_sector: Optional[str] = None
    tier3_unit: Optional[str] = None
    nipost_legacy: Optional[str] = None
    plus_code: Optional[str] = None
    building_type: Optional[str] = "Commercial / Mixed-Use Parcel"
    lat: float
    lng: float
    building_polygon: Optional[List[List[float]]] = None
    confidence: float = 0.98
    verified: bool = True
    is_alias: bool = False

class LookupResponse(BaseModel):
    status: str = Field(default="success")
    source: str
    latency_ms: float
    data: PostcodeData

class WidgetSessionRequest(BaseModel):
    publishable_key: str = Field(default="pk_test_postcode360_abuja_01")
    nin: Optional[str] = None
    email: Optional[str] = None

class WidgetSessionResponse(BaseModel):
    status: str = Field(default="success")
    session_token: str
    token_type: str = Field(default="Bearer")
    expires_in: int = 1800
    bound_origin: str
    identity_type: str
    raw_pii_retained: bool = False
    subject_hash: str

class OrderCreateRequest(BaseModel):
    idempotency_key: str
    postcode: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    amount_ngn: Optional[float] = 180000.0
    notes: Optional[str] = None
    social_store_slug: Optional[str] = None

class OrderResponse(BaseModel):
    status: str = Field(default="success")
    idempotent_replay: bool = False
    order_id: str
    idempotency_key: str
    postcode: str
    district: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    amount_ngn: Optional[float] = 180000.0
    notes: Optional[str] = None
    social_store_slug: Optional[str] = None
    delivery_address: str
    lat: float
    lng: float
    building_polygon: Optional[List[List[float]]] = None
    assigned_rider: Optional[str] = None
    order_status: str = "PENDING"

class NearestItem(BaseModel):
    id: str
    name: str
    category_or_status: str
    phone: Optional[str] = None
    vehicle: Optional[str] = None
    plate: Optional[str] = None
    zone: Optional[str] = None
    eta_mins: Optional[int] = None
    rating: Optional[float] = None
    trauma_level: Optional[str] = None
    address: Optional[str] = None
    lat: float
    lng: float
    distance_meters: float

class NearestSearchResponse(BaseModel):
    status: str = Field(default="success")
    source: str
    search_center: dict
    radius_meters: float
    count: int
    results: List[NearestItem]

class SocialProductItem(BaseModel):
    id: str
    title: str
    price_ngn: float
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    stock_count: int = 10
    product_link: str

class SocialStoreRecord(BaseModel):
    store_slug: str
    merchant_name: str
    merchant_handle: Optional[str] = None
    merchant_phone: str
    pickup_postcode: str
    pickup_location: Optional[dict] = None
    bio_link: str
    products: List[SocialProductItem] = []
    created_at: Optional[str] = None

class SocialStoreCreateRequest(BaseModel):
    store_slug: Optional[str] = None
    merchant_name: str
    merchant_handle: Optional[str] = None
    merchant_phone: str
    pickup_postcode: str
    products: Optional[List[SocialProductItem]] = None
