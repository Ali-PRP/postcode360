CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Canonical Postcodes Table (cached from NIPOST Lookup API)
CREATE TABLE IF NOT EXISTS postcodes (
    code VARCHAR(20) PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    lga VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    street TEXT,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    building_polygon GEOGRAPHY(Polygon, 4326),
    confidence NUMERIC(3, 2) DEFAULT 0.97,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Aliases & Temporary Postcodes (TP-XXXX-XXXX with 90-day TTL)
CREATE TABLE IF NOT EXISTS aliases (
    alias_code VARCHAR(32) PRIMARY KEY,
    canonical_postcode VARCHAR(20) REFERENCES postcodes(code) ON DELETE SET NULL,
    alias_name VARCHAR(150) NOT NULL,
    is_temp_code BOOLEAN DEFAULT FALSE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    proof_image_url TEXT,
    trust_score INT DEFAULT 1,
    delivery_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders Table (Idempotent checkout records linked to postcode)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    merchant_origin VARCHAR(255) NOT NULL,
    customer_nin_hash VARCHAR(64) NOT NULL,
    postcode VARCHAR(32) NOT NULL,
    delivery_location GEOGRAPHY(Point, 4326) NOT NULL,
    assigned_rider_id UUID,
    status VARCHAR(30) DEFAULT 'PENDING',
    pod_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Rider Live Locations Table (for ST_DWithin nearest-rider dispatch)
CREATE TABLE IF NOT EXISTS rider_loc (
    rider_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_name VARCHAR(100) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    current_location GEOGRAPHY(Point, 4326) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    battery_pct INT DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Emergency Facilities Table (for PostGIS KNN Rescue Router)
CREATE TABLE IF NOT EXISTS emergency_facilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    facility_type VARCHAR(50) NOT NULL, -- 'HOSPITAL', 'POLICE', 'FIRE'
    lga VARCHAR(100) NOT NULL,
    phone VARCHAR(25),
    location GEOGRAPHY(Point, 4326) NOT NULL
);

-- 7. GIST Spatial Indexes for <87ms p95 lookups and proximity queries
CREATE INDEX IF NOT EXISTS idx_postcodes_gist ON postcodes USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_aliases_gist ON aliases USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_orders_gist ON orders USING GIST (delivery_location);
CREATE INDEX IF NOT EXISTS idx_rider_loc_gist ON rider_loc USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_facilities_gist ON emergency_facilities USING GIST (location);

-- 8. Seed Abuja Pilot Data (Wuse II & Garki Postcodes, Riders, and Facilities)
INSERT INTO postcodes (code, state, lga, district, street, location, confidence, verified)
VALUES
  ('FC-02-A09-DB-09', 'Federal Capital Territory', 'AMAC', 'Wuse II', 'Adetokunbo Ademola Crescent', ST_SetSRID(ST_MakePoint(7.4892, 9.0765), 4326)::geography, 0.98, TRUE),
  ('FC-01-A01-KP-27', 'Federal Capital Territory', 'AMAC', 'Garki', 'Tafawa Balewa Way', ST_SetSRID(ST_MakePoint(7.4898, 9.0354), 4326)::geography, 0.97, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO rider_loc (rider_name, phone, current_location, is_available, battery_pct)
VALUES
  ('Musa Ibrahim (Wuse Rider)', '+2348030000001', ST_SetSRID(ST_MakePoint(7.4850, 9.0740), 4326)::geography, TRUE, 92),
  ('Chinedu Okafor (Garki Rider)', '+2348030000002', ST_SetSRID(ST_MakePoint(7.4910, 9.0380), 4326)::geography, TRUE, 85);

INSERT INTO emergency_facilities (name, facility_type, lga, phone, location)
VALUES
  ('Wuse District Hospital', 'HOSPITAL', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4660, 9.0645), 4326)::geography),
  ('Garki Hospital Abuja', 'HOSPITAL', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4952, 9.0298), 4326)::geography),
  ('FCT Fire Service Wuse', 'FIRE', 'AMAC', '112', ST_SetSRID(ST_MakePoint(7.4720, 9.0680), 4326)::geography);