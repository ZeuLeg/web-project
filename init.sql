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

-- 6. Kitaplar
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) UNIQUE NOT NULL,
    author VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL
);

-- 7. Kitap Odunc Kayitlari
CREATE TABLE IF NOT EXISTS book_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    book_id INT REFERENCES books(id) ON DELETE CASCADE,
    borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    returned_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS book_loans_one_active_per_book
ON book_loans (book_id)
WHERE status = 'active';

-- Kullanıcılar server/index.js'de seeding yapılır (argon2 hash ile)
-- init.sql'de user eklenmez - düz şifre saklamayamız

INSERT INTO zones (name) VALUES ('1. Kat'), ('2. Kat'), ('3. Kat') ON CONFLICT DO NOTHING;
INSERT INTO desks (zone_id, desk_number)
SELECT zones.id, desk_numbers.desk_number
FROM zones
CROSS JOIN generate_series(1, 15) AS desk_numbers(desk_number)
WHERE zones.name IN ('1. Kat', '2. Kat', '3. Kat')
ON CONFLICT DO NOTHING;

INSERT INTO books (title, author, category)
VALUES
    ('1984', 'George Orwell', 'edebiyat'),
    ('Savaş ve Barış', 'Lev Tolstoy', 'edebiyat'),
    ('Suç ve Ceza', 'Fyodor Dostoyevsky', 'edebiyat'),
    ('Gurur ve Önyargı', 'Jane Austen', 'edebiyat'),
    ('Büyük Umutlar', 'Charles Dickens', 'edebiyat'),
    ('Jane Eyre', 'Charlotte Brontë', 'edebiyat'),
    ('Wuthering Heights', 'Emily Brontë', 'edebiyat'),
    ('Dönüşüm', 'Franz Kafka', 'edebiyat'),
    ('Karanlık Kalpler', 'Joseph Conrad', 'edebiyat'),
    ('Çalışan Yükseklikleri', 'Thomas Hardy', 'edebiyat'),
    ('Oliver Twist', 'Charles Dickens', 'edebiyat'),
    ('Bodrum Evi', 'Anne Frank', 'edebiyat'),
    ('Kumarbaz', 'Fyodor Dostoyevsky', 'edebiyat'),
    ('Madame Bovary', 'Gustave Flaubert', 'edebiyat'),
    ('Les Misérables', 'Victor Hugo', 'edebiyat'),
    ('Üç Silahşörler', 'Alexandre Dumas', 'edebiyat'),
    ('Pinocchio''nun Macaları', 'Carlo Collodi', 'edebiyat'),
    ('Faust', 'Johann Wolfgang von Goethe', 'edebiyat'),
    ('Don Quixote', 'Miguel de Cervantes', 'edebiyat'),
    ('Uğultulu Tepeler', 'Emily Brontë', 'edebiyat'),
    ('Köpek Kalbi', 'Mikhail Bulgakov', 'edebiyat'),
    ('Anna Karenina', 'Lev Tolstoy', 'edebiyat'),
    ('Hazine Adası', 'Robert Louis Stevenson', 'edebiyat'),
    ('Gönül Savaşı', 'Emily Dickinson', 'edebiyat'),
    ('Usta ve Margarita', 'Mikhail Bulgakov', 'edebiyat'),
    ('İnsan Trol', 'Henrik Ibsen', 'edebiyat'),
    ('Kara Şövalye', 'Walter Scott', 'edebiyat'),
    ('Portre''nin Gölgesi', 'Oscar Wilde', 'edebiyat'),
    ('Kara Şapka', 'Jeff Dieter', 'siber'),
    ('Şifreleme Temelleri', 'David Kahn', 'siber'),
    ('Ağ Saldırıları', 'Laura Chappell', 'siber'),
    ('Siber Savunma', 'Daniel Miessler', 'siber'),
    ('Etik Hackerlik', 'Georgia Weidman', 'siber'),
    ('Bilgisayar Mimarisi', 'David Patterson', 'donanim'),
    ('CPU Tasarımı', 'John Hennessy', 'donanim'),
    ('Bellek Yönetimi', 'Randal Bryant', 'donanim'),
    ('Veri Depolama', 'Kai Hwang', 'donanim'),
    ('İşlemci Teknolojisi', 'Geoff Knottenbelt', 'donanim'),
    ('Veri Yapıları', 'Mark Allen Weiss', 'yazilim'),
    ('Algoritmaların Analizi', 'Thomas Cormen', 'yazilim'),
    ('Temiz Kod', 'Robert Martin', 'yazilim'),
    ('Tasarım Desenleri', 'Gang of Four', 'yazilim'),
    ('Yazılım Mimarisi', 'Robert Martin', 'yazilim')
ON CONFLICT (title) DO UPDATE
SET author = EXCLUDED.author,
    category = EXCLUDED.category;
