-- ============================================================================
-- Postcode360 Spatial Database Schema (PostGIS EPSG:4326 + Supabase Postgres)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Canonical Postcodes Table (cached from NIPOST Lookup API)
CREATE TABLE IF NOT EXISTS postcodes (
    code VARCHAR(20) PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    lga VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    street TEXT,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    building_polygon JSONB,
    confidence NUMERIC(3, 2) DEFAULT 0.98,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Aliases & Temporary Postcodes (TP-XXXX-XXXX with 90-day TTL)
CREATE TABLE IF NOT EXISTS aliases (
    alias_code VARCHAR(32) PRIMARY KEY,
    canonical_postcode VARCHAR(20) REFERENCES postcodes(code) ON DELETE SET NULL,
    alias_name VARCHAR(150) NOT NULL,
    is_temp_code BOOLEAN DEFAULT TRUE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    proof_image_url TEXT,
    trust_score INT DEFAULT 1,
    delivery_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Social Stores (No-Code Social Media Vendor Storefronts)
CREATE TABLE IF NOT EXISTS social_stores (
    store_slug VARCHAR(100) PRIMARY KEY,
    merchant_name VARCHAR(150) NOT NULL,
    merchant_handle VARCHAR(100),
    merchant_phone VARCHAR(40) NOT NULL,
    pickup_postcode VARCHAR(32) NOT NULL,
    pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
    bio_link VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Social Store Catalog Products
CREATE TABLE IF NOT EXISTS social_products (
    id VARCHAR(64) PRIMARY KEY,
    store_slug VARCHAR(100) REFERENCES social_stores(store_slug) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    price_ngn NUMERIC(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    stock_count INT DEFAULT 10,
    product_link VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Orders Table (Idempotent checkout records linked to postcode & social store)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    merchant_origin VARCHAR(255) DEFAULT 'http://localhost:5173',
    customer_nin_hash VARCHAR(64) DEFAULT 'sha256:anonymous',
    postcode VARCHAR(32) NOT NULL,
    customer_name VARCHAR(150) DEFAULT 'Customer',
    customer_phone VARCHAR(40) DEFAULT '+2348030000000',
    amount_ngn NUMERIC(12, 2) DEFAULT 180000.00,
    notes TEXT,
    social_store_slug VARCHAR(100),
    delivery_location GEOGRAPHY(Point, 4326) NOT NULL,
    assigned_rider_id VARCHAR(64),
    status VARCHAR(30) DEFAULT 'PENDING',
    pod_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Rider Live Locations Table (for 3PL ST_DWithin / KNN nearest-rider dispatch)
CREATE TABLE IF NOT EXISTS rider_loc (
    rider_id VARCHAR(64) PRIMARY KEY,
    rider_name VARCHAR(100) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    current_location GEOGRAPHY(Point, 4326) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    battery_pct INT DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Emergency Facilities Table (for PostGIS KNN Rescue Router)
CREATE TABLE IF NOT EXISTS emergency_facilities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    facility_type VARCHAR(50) NOT NULL, -- 'HOSPITAL', 'POLICE', 'FIRE'
    lga VARCHAR(100) NOT NULL,
    phone VARCHAR(25),
    location GEOGRAPHY(Point, 4326) NOT NULL
);

-- 8. GIST Spatial Indexes for fast spatial lookups & proximity queries
CREATE INDEX IF NOT EXISTS idx_postcodes_gist ON postcodes USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_aliases_gist ON aliases USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_orders_gist ON orders USING GIST (delivery_location);
CREATE INDEX IF NOT EXISTS idx_rider_loc_gist ON rider_loc USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_facilities_gist ON emergency_facilities USING GIST (location);

-- 9. Seed Abuja Pilot Postcodes
INSERT INTO postcodes (code, state, lga, district, street, location, confidence, verified)
VALUES
  ('FC-02-A09-DB-09', 'Federal Capital Territory', 'AMAC', 'Wuse II', 'Adetokunbo Ademola Crescent', ST_SetSRID(ST_MakePoint(7.4892, 9.0765), 4326)::geography, 0.98, TRUE),
  ('FC-01-C01-CB-05', 'Federal Capital Territory', 'AMAC', 'Central Business District', 'Plot 1141 Shehu Shagari Way', ST_SetSRID(ST_MakePoint(7.4951, 9.0579), 4326)::geography, 0.98, TRUE),
  ('FC-01-M04-MA-03', 'Federal Capital Territory', 'AMAC', 'Maitama', '9 Yedseram / Aguiyi Ironsi Street', ST_SetSRID(ST_MakePoint(7.4934, 9.0882), 4326)::geography, 0.99, TRUE),
  ('FC-03-J07-JB-11', 'Federal Capital Territory', 'AMAC', 'Jabi', '25 Bala Sokoto Way', ST_SetSRID(ST_MakePoint(7.4245, 9.0642), 4326)::geography, 0.98, TRUE),
  ('FC-02-B12-GA-01', 'Federal Capital Territory', 'AMAC', 'Garki Area 11', '18 Tafawa Balewa Way', ST_SetSRID(ST_MakePoint(7.4898, 9.0354), 4326)::geography, 0.97, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 10. Seed Default Social Store & Products (Luxe Atelier Abuja)
INSERT INTO social_stores (store_slug, merchant_name, merchant_handle, merchant_phone, pickup_postcode, pickup_location, bio_link)
VALUES
  ('luxe-atelier-abj', 'Luxe Atelier Abuja', '@luxeatelier.ng', '+2348035550192', 'FC-02-A09-DB-09', ST_SetSRID(ST_MakePoint(7.4892, 9.0765), 4326)::geography, 'https://postcode360.ng/store/luxe-atelier-abj')
ON CONFLICT (store_slug) DO NOTHING;

INSERT INTO social_products (id, store_slug, title, price_ngn, category, description, image_url, stock_count, product_link)
VALUES
  ('prod-wig-01', 'luxe-atelier-abj', '30" Bone Straight Raw Vietnamese Wig', 600000.00, 'Luxury Hair', '100% Raw unprocessed bone straight double drawn human hair with HD frontal lace.', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80', 8, 'https://postcode360.ng/pay/luxe-atelier-abj/prod-wig-01'),
  ('prod-bag-02', 'luxe-atelier-abj', 'Structured Top-Handle Leather Bag', 600000.00, 'Accessories', 'Italian vegetable-tanned cowhide with gold-plated hardware and protective feet.', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80', 15, 'https://postcode360.ng/pay/luxe-atelier-abj/prod-bag-02'),
  ('prod-oud-03', 'luxe-atelier-abj', 'Royal Arabian Oud Extrait Perfume (100ml)', 100000.00, 'Artisanal Perfumery', 'Concentrated pure agarwood extrait infused with Damascus rose and ambergris.', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80', 25, 'https://postcode360.ng/pay/luxe-atelier-abj/prod-oud-03')
ON CONFLICT (id) DO NOTHING;

-- 11. Seed 3PL Partner Riders
INSERT INTO rider_loc (rider_id, rider_name, phone, current_location, is_available, battery_pct)
VALUES
  ('rdr-abuja-01', 'Musa Ibrahim (Wuse 3PL)', '+2348030000001', ST_SetSRID(ST_MakePoint(7.4850, 9.0740), 4326)::geography, TRUE, 92),
  ('rdr-abuja-02', 'Chinedu Okafor (Garki 3PL)', '+2348030000002', ST_SetSRID(ST_MakePoint(7.4910, 9.0380), 4326)::geography, TRUE, 85)
ON CONFLICT (rider_id) DO NOTHING;

-- 12. Seed Emergency Facilities
INSERT INTO emergency_facilities (id, name, facility_type, lga, phone, location)
VALUES
  ('emg-01', 'Wuse District Hospital', 'HOSPITAL', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4660, 9.0645), 4326)::geography),
  ('emg-02', 'Garki Hospital Abuja', 'HOSPITAL', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4952, 9.0298), 4326)::geography),
  ('emg-03', 'FCT Fire Service Wuse', 'FIRE', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4720, 9.0680), 4326)::geography)
ON CONFLICT (id) DO NOTHING;
