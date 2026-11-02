from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class LookupRequest(BaseModel):
    code: str = Field(
        ...,
        min_length=5,
        max_length=32,
        description="11-character NIPOST alphanumeric postcode or temporary alias (e.g., FC-02-A09-DB-09)",
        examples=["FC-02-A09-DB-09"],
    )
    force_mock: Optional[bool] = Field(
        default=None,
        description="Optional per-request override to force mock cache resolution without rate limits",
    )


class PostcodeData(BaseModel):
    postcode: str = Field(..., examples=["FC-02-A09-DB-09"])
    formatted: str = Field(..., examples=["FC 02 A09 DB 09"])
    state: str = Field(..., examples=["Federal Capital Territory"])
    lga: str = Field(..., examples=["Abuja Municipal (AMAC)"])
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
    source: str = Field(
        ...,
        description="Resolution tier: 'postgis_db', 'nipost_upstream', or 'mock_cache'",
        examples=["postgis_db"],
    )
    latency_ms: float = Field(..., examples=[14.2])
    data: PostcodeData

    model_config = ConfigDict(from_attributes=True)
