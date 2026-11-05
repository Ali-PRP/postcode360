export interface HealthResponse {
  status: string;
  postgis_connected: boolean;
  upstream_mock: boolean;
  db_error: string | null;
}

export interface WidgetSessionRequest {
  publishable_key?: string;
  nin?: string | null;
  email?: string | null;
}

export interface WidgetSessionResponse {
  status: string;
  session_token: string;
  token_type: string;
  expires_in: number;
  bound_origin: string;
  identity_type: "nin" | "email" | string;
  raw_pii_retained?: boolean;
  subject_hash: string;
}

export interface PostcodeData {
  postcode: string;
  formatted: string;
  state: string;
  lga: string;
  district?: string | null;
  street?: string | null;
  tier1_state?: string | null;
  tier2_sector?: string | null;
  tier3_unit?: string | null;
  nipost_legacy?: string | null;
  plus_code?: string | null;
  building_type?: string | null;
  lat: number;
  lng: number;
  building_polygon?: number[][] | null;
  confidence: number;
  verified: boolean;
  is_alias: boolean;
}

export interface LookupRequest {
  code: string;
  force_mock?: boolean | null;
}

export interface LookupResponse {
  status: string;
  source: string;
  latency_ms: number;
  data: PostcodeData;
}

export interface OrderCreateRequest {
  idempotency_key: string;
  postcode: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  amount_ngn?: number | null;
  notes?: string | null;
}

export interface OrderResponse {
  status: string;
  idempotent_replay: boolean;
  order_id: string;
  idempotency_key: string;
  postcode: string;
  district?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  amount_ngn?: number | null;
  notes?: string | null;
  delivery_address: string;
  lat: number;
  lng: number;
  building_polygon?: number[][] | null;
  assigned_rider?: string | null;
  order_status: "PENDING" | "DISPATCHED" | "DELIVERED" | string;
}

export interface NearestItem {
  id: string;
  name: string;
  category_or_status: string;
  phone?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  zone?: string | null;
  eta_mins?: number | null;
  rating?: number | null;
  trauma_level?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  distance_meters: number;
}

export interface NearestSearchResponse {
  status: string;
  source: string;
  search_center: {
    lat: number;
    lng: number;
  };
  radius_meters: number;
  count: number;
  results: NearestItem[];
}

export interface ApiTelemetryEntry {
  id: string;
  timestamp: string;
  method: "GET" | "POST" | "PATCH";
  endpoint: string;
  requestBody?: unknown;
  status: number;
  mode: "FASTAPI_LIVE" | "POSTGIS_SANDBOX";
  latencyMs: number;
}
