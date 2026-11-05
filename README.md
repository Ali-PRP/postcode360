# Postcode360 📍

**3-Tier Nigerian Spatial Postcode Resolution, Zero-PII Checkout & PostGIS Last-Mile Dispatch Platform**

[![Stack](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Supabase-PostGIS%20EPSG%3A4326-3ECF8E?logo=postgresql&logoColor=white)](https://postgis.net/)
[![Frontend](https://img.shields.io/badge/React%2019-Vite%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)](https://vite.dev/)
[![Maps](https://img.shields.io/badge/MapLibre%20GL-Esri%20Satellite%20%2B%20SVG%20CAD-396CB2)](https://maplibre.org/)
[![Security](https://img.shields.io/badge/Privacy-Zero--PII%20HMAC--SHA256-8B5CF6)](#zero-pii-security-architecture)

> **Lead Engineering (Team A — Merchant Checkout, Spatial Map Engine, Back-Office Admin & Plugins):** Aliyu ([@Ali-PRP](https://github.com/Ali-PRP))
> **Active Branch:** `fea/merchant` → `dev`

---

## 1. Executive Overview

**Postcode360** solves Nigeria's last-mile addressing, e-commerce checkout, and emergency dispatch challenge by replacing ambiguous street descriptions with a verifiable **3-Tier Spatial Postcode** (`State - Sector - Building Unit`, e.g., `FC-02-A09-DB-09`).

Built for the **Abuja FCT Spatial Pilot** with state-aware expansion across Nigeria (`LA` Lagos, `KN` Kano, `RV` Rivers, `OY` Oyo, `KD` Kaduna, `EN` Enugu, `ED` Edo, `AN` Anambra, `OG` Ogun, `DT` Delta, `PL` Plateau), the platform combines a **FastAPI + Supabase PostGIS** spatial backend with a **React + MapLibre GL** merchant and dispatch workspace.

---

## 2. Core System Architecture

### A. Step 01 — Zero-PII Widget Session Handshake (`POST /v1/widget/session`)

- **Server-Side HMAC-SHA256 Hashing**: Shoppers verify using an **11-digit Nigerian NIN** or **Email Address**. Raw PII is immediately hashed using a salted HMAC-SHA256 digest (`sha256:...`) and never stored in plaintext (`raw_pii_retained: false`).
- **Origin-Bound Publishable Keys**: Validates merchant publishable keys (`pk_test_findam_abuja_01`) against authorized request `Origin` headers before issuing short-lived HS256 session JWTs.

### B. Step 02 — 3-Tier Spatial Postcode Resolution (`POST /v1/lookup` & `GET /v1/mock/postcodes`)

- **3-Tier Code Dissection**:
  - **Tier 1 (State)**: `FC (FCT Abuja)`, `LA (Lagos State)`, `KN (Kano State)`, etc.
  - **Tier 2 (Sector / District)**: Cadastral zone or district (`02-A09 Wuse II Commercial Core`, `Garki Area 11`, `Maitama Diplomatic Zone`, `Central Business District`, `Jabi Lakefront`).
  - **Tier 3 (Building Footprint)**: Exact parcel code (`DB-09`) mapped to an `EPSG:4326` rooftop building polygon (`building_polygon`), Google Plus Code (`6FX93FGP+JM`), and legacy NIPOST code (`900288`).
- **3-Tier Resolution Waterfall**:
  1. **Tier 1 Cache / Mock Sandbox**: Instant sub-10ms resolution for pre-seeded pilot bookmarks.
  2. **Tier 2 PostGIS Spatial DB**: Queries canonical `postcodes` and 90-day TTL `aliases` (`TP-XXXX-XXXX`) tables indexed with PostGIS `GIST`.
  3. **Tier 3 NIPOST Upstream & State-Aware Grid Synthesizer**: Resolves upstream NIPOST records or synthesizes state-accurate parcel polygons and coordinates across 12+ Nigerian state prefixes so far.

### C. Step 03 — Idempotent Merchant Checkout (`POST /orders`)

- **Zero Double-Charge Guarantee**: Every checkout request carries a unique `idempotency_key` (e.g., `ord-wuse2-2026-001`).
- **Network Retry Simulator**: Built-in UI control simulates unstable mobile network double-taps; re-submitting an existing `idempotency_key` is intercepted by the PostGIS unique constraint and in-memory ledger, returning the existing order with `idempotent_replay: true` and `₦0` additional charge.

### D. Satellite + Camera-Locked SVG Vector Map Engine (`PostcodeMap.tsx`)

- **Esri World Imagery Satellite & OSM Streets Switcher**: Defaults to high-resolution Esri satellite imagery with a 1-click toggle to OpenStreetMap street tiles.
- **Dynamic Architectural Building Polygons (`V1..Vn`)**: Renders distinct multi-vertex building footprints (`6-vertex L-plaza` in Wuse II, `8-vertex cruciform tower` in CBD, `6-vertex hexagonal villa` in Maitama, `8-vertex U-courtyard` in Garki, `5-vertex terrace` in Jabi) with hoverable corner nodes displaying exact `[lng, lat]` coordinates.
- **Live Dispatch & Rescue Trajectory Vectors**: Draws a glowing dashed cyan vector line (with distance midpoint pill and `Fit Rider Route` / `Focus Rooftop` camera framing) connecting the closest rider to the target building centroid, alongside a dashed rose vector to the nearest emergency facility.

### E. Task #7 — Back-Office Admin & PostGIS KNN Dispatch Ledger (`AdminDashboard.tsx`)

- **Live Order Queue & Status Filters**: Filter live PostGIS orders by `ALL`, `PENDING`, `DISPATCHED`, and `DELIVERED`, or search by Order ID, Postcode, Customer Name, Street, or Idempotency Key.
- **PostGIS GiST KNN Nearest Rider Dispatch (`GET /riders/nearest`)**: Uses `ST_DWithin` and the PostGIS `<->` KNN distance operator to rank available dispatch riders by exact meter distance and ETA, supporting 1-click rider assignment (`PATCH /orders/{order_id}`).
- **Flow C Emergency Triage (`GET /emergency/nearest`)**: Instant spatial lookup for the closest `HOSPITAL`, `POLICE`, or `FIRE` response unit around any selected order or postcode.

### F. Task #5 & #6 — Drop-in WooCommerce & Shopify Integrations (`plugins/` & `extensions/`)

- **WooCommerce PHP Plugin (`postcode360-checkout.php`)**: Injects the 3-tier postcode field into WooCommerce billing checkout, enqueues the origin-bound widget SDK, and syncs processed orders to `POST /orders` with deterministic idempotency keys (`woo-ord-{id}`).
- **Shopify Theme App Extension (`postcode-widget.liquid`)**: Embeddable Liquid block that resolves postcodes during cart/checkout and attaches `postcode360_code`, `postcode360_lat`, and `postcode360_lng` to Shopify cart attributes. Includes an interactive **Shopify Theme Editor Simulator** in the frontend workspace.

---

## 3. Repository Structure

```text
postcode360/
├── backend/
│   ├── main.py                  # FastAPI application, CORS, 3-tier lookup, orders & KNN routes
│   ├── database.py              # SQLAlchemy 2.0 + Psycopg 3 engine & session pool for Supabase PostGIS
│   ├── schemas.py               # Pydantic v2 request/response contracts
│   ├── security.py              # HMAC-SHA256 PII hashing, origin-bound key registry & HS256 JWTs
│   └── mock_postcodes.json      # Canonical Abuja pilot postcodes & multi-vertex building polygons
├── database/
│   └── schema.sql               # PostGIS extension, tables (postcodes, aliases, orders, rider_loc, emergency_facilities) & GiST indexes
├── plugins/
│   └── woocommerce-postcode360/
│       └── postcode360-checkout.php   # Task #5: WordPress / WooCommerce checkout plugin
├── extensions/
│   └── postcode360-checkout/
│       └── blocks/
│           └── postcode-widget.liquid # Task #6: Shopify Theme App Extension Liquid block
├── merchant-portal/             # React 19 + TypeScript + Vite + Tailwind CSS + MapLibre GL frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/Navbar.tsx          # Header, live health badges & collapsible API Telemetry Logs drawer
│   │   │   ├── checkout/PiiSessionCard.tsx # Step 01: NIN/Email HMAC-SHA256 handshake card
│   │   │   ├── checkout/PostcodeLookup.tsx # Step 02: 3-Tier postcode lookup & dissection card
│   │   │   ├── checkout/OrderCheckout.tsx  # Step 03: Idempotent checkout & retry simulator
│   │   │   ├── map/PostcodeMap.tsx         # Esri Satellite + OSM + SVG Vector footprint & trajectory map
│   │   │   ├── admin/AdminDashboard.tsx    # Task #7: Back-office order queue, status filters & KNN dispatch
│   │   │   └── plugins/PluginTemplates.tsx # Task #5/#6: Plugin code inspector & Shopify Theme simulator
│   │   ├── services/api.ts      # Hybrid FastAPI client with automatic offline sandbox fallback & telemetry
│   │   ├── types/postcode360.ts # Shared TypeScript interfaces aligned with backend/schemas.py
│   │   └── App.tsx              # Unified workspace controller
│   └── package.json
└── requirements.txt             # Python backend dependencies
```
