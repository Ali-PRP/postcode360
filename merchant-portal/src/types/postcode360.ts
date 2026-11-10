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

// --- (fea/rider): Rider OS, POD & TP-Code Inclusion Types ---

export interface AliasMintRequest {
  lat: number;
  lng: number;
  alias_name: string;
  canonical_postcode?: string;
  district?: string;
  proof_image_url?: string;
  pod_image_url?: string;
  building_polygon?: number[][];
}

export interface AliasRecord {
  alias_code: string;
  canonical_postcode?: string | null;
  alias_name: string;
  district: string;
  lat: number;
  lng: number;
  proof_image_url?: string | null;
  trust_score: number;
  delivery_count: number;
  is_temp_code: boolean;
  verified: boolean;
  expires_at: string;
  building_polygon: number[][];
}

export interface RiderRecord {
  rider_id: string;
  rider_name: string;
  phone: string;
  lat: number;
  lng: number;
  is_available: boolean;
  battery_pct: number;
  updated_at: string;
}

export interface PodSubmitRequest {
  rider_id: string;
  rider_lat: number;
  rider_lng: number;
  pod_image_url: string;
  recipient_signature?: string;
}

export interface PodSubmitResponse {
  status: string;
  order_id: string;
  order_status: string;
  pod_image_url: string;
  gps_distance_from_polygon_m: number;
  gps_verified: boolean;
  alias_auto_promoted: boolean;
  delivered_at: string;
}

export interface SosTriggerRequest {
  postcode: string;
  lat: number;
  lng: number;
  address?: string;
  caller_phone: string;
  triage_level: "RED" | "YELLOW";
  emergency_type: "HOSPITAL" | "POLICE" | "FIRE" | "FRSC";
}

export interface SosIncidentRecord {
  incident_id: string;
  postcode: string;
  address: string;
  caller_phone: string;
  triage_level: string;
  emergency_type: string;
  lat: number;
  lng: number;
  assigned_responder: string;
  responder_phone: string;
  distance_meters: number;
  eta_minutes: number;
  status: string;
  termii_sms_preview: string;
  created_at: string;
}

export interface UssdDialResponse {
  status: string;
  ussd_code: string;
  msisdn: string;
  resolved_postcode: string;
  lat: number;
  lng: number;
  screen_text: string;
}

export interface OfflineTilePack {
  pack_id: string;
  lga: string;
  uri: string;
  radius_km: number;
  size_mb: number;
  cached_polygons: number;
  status: "CACHED_WIFI" | "AVAILABLE";
  last_synced?: string | null;
}

export interface BookmarkItem {
  postcode: string;
  label: string;
}

export interface BookmarksResponse {
  status: string;
  subject_hash: string;
  raw_pii_stored: boolean;
  count: number;
  bookmarks: BookmarkItem[];
}

export interface SearchPostcodeItem {
  postcode: string;
  district: string;
  street: string;
  lat: number;
  lng: number;
  verified: boolean;
  is_alias: boolean;
}

export interface SearchPostcodeResponse {
  status: string;
  type: string;
  query: string;
  count: number;
  results: SearchPostcodeItem[];
}
export interface DeliveryProofRecord {
  delivery_id: string;
  order_id: string;
  postcode: string;
  district: string;
  street: string;
  customer_name: string;
  rider_name: string;
  lat: number;
  lng: number;
  gps_offset_m: number;
  pod_photo_url: string;
  delivered_at: string;
  status: string;
}

export interface DeliveryProofsResponse {
  status: string;
  dataset_id?: string;
  task_id?: string;
  corridor: string;
  count: number;
  proofs: DeliveryProofRecord[];
}

export interface SocialProductItem {
  id: string;
  title: string;
  price_ngn: number;
  category: string;
  description?: string | null;
  image_url?: string | null;
  stock_count?: number;
  product_link?: string;
}

export interface SocialStoreRecord {
  store_slug: string;
  merchant_name: string;
  merchant_handle?: string | null;
  merchant_phone: string;
  pickup_postcode: string;
  pickup_location?: {
    lat: number;
    lng: number;
  } | null;
  bio_link: string;
  products: SocialProductItem[];
  created_at?: string | null;
}

export interface SocialStoreCreateRequest {
  store_slug?: string | null;
  merchant_name: string;
  merchant_handle?: string | null;
  merchant_phone: string;
  pickup_postcode: string;
  products?: SocialProductItem[] | null;
}

export interface AutocompleteSuggestion {
  postcode: string;
  formatted?: string;
  district: string;
  state: string;
  street?: string;
}

export interface StorefrontProduct {
  id: string;
  title: string;
  price_ngn: number;
  category: string;
  description: string;
  image_url: string;
  stock_count: number;
  vendor_name: string;
  vendor_handle: string;
  vendor_phone: string;
}

export interface StorefrontCustomerSelection {
  productId: string;
  email: string;
  selectedPostcode: string;
  customerName?: string;
  customerPhone?: string;
  deliveryNotes?: string;
}
