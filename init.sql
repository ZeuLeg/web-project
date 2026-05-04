-- 1. UUID Uzantısı
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tc_id VARCHAR(11) UNIQUE,
    student_id VARCHAR(9) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student'
);

-- 3. Kütüphane Alanları
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 4. Masalar
CREATE TABLE IF NOT EXISTS desks (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id) ON DELETE CASCADE,
    desk_number INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Aynı bölgede aynı masa numarası olamaz
    UNIQUE (zone_id, desk_number)
);

-- 5. Rezervasyonlar
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    desk_id INT REFERENCES desks(id) ON DELETE CASCADE,
    seat_number INT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test için veri ekleme
INSERT INTO zones (name) VALUES ('1. Kat'), ('2. Kat'), ('3. Kat') ON CONFLICT DO NOTHING;
INSERT INTO desks (zone_id, desk_number)
SELECT zones.id, desk_numbers.desk_number
FROM zones
CROSS JOIN generate_series(1, 15) AS desk_numbers(desk_number)
WHERE zones.name IN ('1. Kat', '2. Kat', '3. Kat')
ON CONFLICT DO NOTHING;
