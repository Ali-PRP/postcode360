# Postcode360 📍

**Spatial Postcode Resolution & Dispatch Platform — Making addressing plug-and-play for Nigerian e-commerce, logistics, and emergency services.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostGIS](https://img.shields.io/badge/Supabase-PostGIS%20EPSG%3A4326-3ECF8E?logo=postgresql&logoColor=white)](https://postgis.net/)
[![React](https://img.shields.io/badge/React%2019-Vite%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)](https://vite.dev/)
[![MapLibre](https://img.shields.io/badge/MapLibre%20GL-Esri%20Satellite%20%2B%20SVG-396CB2)](https://maplibre.org/)

> Built by [NovaSync Solutions](https://github.com/Ali-PRP) — **Aliyu** ([@Ali-PRP](https://github.com/Ali-PRP))

---

## What is Postcode360?

**Paystack made payments plug-and-play. Postcode360 makes spatial addressing plug-and-play.**

Postcode360 replaces ambiguous street descriptions with a verifiable **5-segment spatial postcode** (`FC-02-A09-DB-09`) that resolves to an exact rooftop building polygon, coordinates, and street address — instantly usable at checkout.

### Who it's for

| Audience | Solution |
|---|---|
| **E-Commerce Websites** | Embeddable Checkout Widget (`@postcode360/checkout-js`) and drop-in WooCommerce/Shopify plugins. At checkout, a buyer enters their email → bookmarked postcodes appear → buyer selects one → merchant gets verified address + coordinates + rooftop polygon. |
| **Social Media Vendors** | No-code storefront with a shareable bio link (`postcode360.ng/store/{vendor}`) and direct product payment links (`postcode360.ng/pay/{product}`). Buyers select products, checkout resolves their delivery postcode. |
| **Logistics / 3PL Companies** | Enumerator SDK (`@postcode360/enumerator-sdk`) for rider apps. Couriers view rooftop polygons and act as crowdsourced enumerators — minting Temporary Postcodes (`TP-...`) that auto-promote after 3 verified deliveries. |

---

## Repository Structure

```
postcode360/
├── backend/                           # FastAPI + Supabase PostGIS backend
│   ├── main.py                        # Application entry, CORS, lookup, orders & KNN routes
│   ├── database.py                    # SQLAlchemy 2.0 + Psycopg 3 engine & session pool
│   ├── schemas.py                     # Pydantic v2 request/response contracts
│   ├── security.py                    # HMAC-SHA256 PII hashing, origin-bound keys & HS256 JWTs
│   ├── rider.py                       # Rider telemetry & dispatch endpoints
│   └── mock_postcodes.json            # Canonical Abuja pilot postcodes & building polygons
│
├── database/
│   └── schema.sql                     # PostGIS extension, tables & GiST spatial indexes
│
├── merchant-portal/                   # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── App.tsx                    # Main workspace controller (5 tabs + dark mode)
│   │   ├── components/
│   │   │   ├── layout/Navbar.tsx      # Top navigation bar & branding
│   │   │   ├── checkout/             
│   │   │   │   ├── CustomerCheckoutWidget.tsx  # Customer-facing checkout experience
│   │   │   │   ├── PiiSessionCard.tsx          # Zero-PII email/NIN HMAC-SHA256 session
│   │   │   │   ├── PostcodeLookup.tsx          # 5-segment postcode resolution
│   │   │   │   ├── OrderCheckout.tsx           # Idempotent order creation & retry handling
│   │   │   │   └── BookmarkSyncBar.tsx         # Email-linked postcode bookmarks
│   │   │   ├── storefront/
│   │   │   │   └── SocialStorefront.tsx        # No-code vendor catalog & payment links
│   │   │   ├── admin/
│   │   │   │   └── AdminDashboard.tsx          # Live order queue, filters & KNN dispatch
│   │   │   ├── rider/
│   │   │   │   └── RiderDashboard.tsx          # Dispatch Hub: courier console, POD & TP minting
│   │   │   ├── map/
│   │   │   │   └── PostcodeMap.tsx             # Satellite/street map with building polygons
│   │   │   └── plugins/
│   │   │       └── PluginTemplates.tsx         # WooCommerce & Shopify plugin inspector
│   │   ├── services/
│   │   │   └── api.ts                 # Hybrid API client with offline fallback & telemetry
│   │   └── types/
│   │       └── postcode360.ts         # Shared TypeScript interfaces
│   ├── plugins/
│   │   ├── woocommerce-postcode360/
│   │   │   └── postcode360-checkout.php        # WooCommerce checkout plugin
│   │   └── shopify-postcode360-embed/
│   │       └── extensions/.../postcode-widget.liquid  # Shopify Theme Extension
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── openapi.json                       # OpenAPI 3.1 contract
├── requirements.txt                   # Python backend dependencies
├── .env.example                       # Environment variable template
└── .gitignore
```

---

## Core Architecture

### 1. Zero-PII Widget Session (`POST /v1/widget/session`)

Shoppers authenticate with an email or NIN. Raw PII is immediately hashed using salted HMAC-SHA256 (`sha256:...`) — never stored in plaintext. Origin-bound publishable keys (`pk_test_postcode360_abuja_01`) validate merchant requests before issuing short-lived HS256 session JWTs.

### 2. 5-Segment Postcode Resolution (`POST /v1/lookup`)

Codes follow the format `State-Sector-District-Unit` (e.g., `FC-02-A09-DB-09`):

- **Tier 1 — State**: `FC` (FCT Abuja), `LA` (Lagos), `KN` (Kano), etc.
- **Tier 2 — Sector/District**: Cadastral zone (`02-A09 Wuse II Commercial Core`)
- **Tier 3 — Building Unit**: Exact parcel mapped to an EPSG:4326 rooftop polygon, Plus Code, and NIPOST legacy code

Resolution waterfall: **In-memory cache → PostGIS spatial DB → NIPOST upstream / state grid synthesizer**.

### 3. Idempotent Checkout (`POST /orders`)

Every order carries a unique `idempotency_key`. Re-submitting the same key returns the existing order with `idempotent_replay: true` and zero additional billing — preventing double charges on unstable mobile networks.

### 4. Crowdsourced Address Minting (`POST /v1/alias/mint`)

Delivery riders mint Temporary Postcodes (`TP-ABJ-XXXX`) where no NIPOST postcode exists. Each TP-code carries a 90-day TTL and auto-promotes to a verified alias after 3 confirmed deliveries.

### 5. PostGIS KNN Dispatch (`GET /riders/nearest`, `GET /emergency/nearest`)

Uses `ST_DWithin` and the PostGIS `<->` KNN distance operator to rank available riders and emergency responders by exact meter distance and ETA.

---

## Getting Started

### Prerequisites

- **Python 3.11+** with `pip`
- **Node.js 18+** with `npm`
- **Supabase** project (or local PostgreSQL with PostGIS extension)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Ali-PRP/postcode360.git
cd postcode360

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate      # Linux/macOS
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase/PostGIS credentials

# Run the API server
cd backend
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd merchant-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to access the merchant portal.

### Production Build

```bash
cd merchant-portal
npm run build    # Outputs to dist/
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase/PostGIS connection string |
| `VITE_API_BASE_URL` | Backend API URL (default: `http://localhost:8000`) |
| `VITE_POSTCODE360_PUBLIC_KEY` | Publishable key for widget sessions |

---

## API Documentation

Interactive API docs available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Spec**: [`openapi.json`](openapi.json)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, SQLAlchemy 2.0, Psycopg 3, Pydantic v2 |
| **Database** | Supabase PostgreSQL + PostGIS (EPSG:4326, GiST indexes) |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Maps** | MapLibre GL JS, Esri World Imagery, OpenStreetMap |
| **Security** | HMAC-SHA256 PII hashing, HS256 JWTs, origin-bound keys |
| **Plugins** | WooCommerce (PHP), Shopify Theme App Extension (Liquid) |

---

## License

All rights reserved. © 2026 NovaSync Solutions.

---

**Postcode360** by [NovaSync Solutions](https://github.com/Ali-PRP)
