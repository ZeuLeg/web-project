import express from "express";
import cors from "cors";
import pkg from "pg";
import argon2 from "argon2";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 1. ESM (Module) ortamı için __dirname çözümlemesi
const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = join(__dirname, "..", "client");
const { Pool } = pkg;
const COMPLAINT_EMAIL_USER =
  process.env.COMPLAINT_EMAIL_USER || "kutuphanesikayet@gmail.com";
const COMPLAINT_EMAIL_TO =
  process.env.COMPLAINT_EMAIL_TO || "yldrmkaan20@gmail.com";
const COMPLAINT_EMAIL_PASS = process.env.COMPLAINT_EMAIL_PASS?.replace(
  /\s/g,
  "",
);
const complaintTopicLabels = {
  gurultu: "Gürültü / Ses Problemi",
  temizlik: "Temizlik ve Hijyen",
  teknik: "Teknik Arıza (Priz, İnternet vs.)",
  personel: "Personel İletişimi",
  oneri: "Genel Öneri",
  diger: "Diğer",
};

const app = express();

// 2. PostgreSQL Veritabanı Bağlantı Havuzu (Pool)
// docker-compose.yml içerisindeki DATABASE_URL değişkenini otomatik okur
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3. Middlewares (Ara Katmanlar)
// CORS'u etkinleştir - Frontend'den gelen isteklere izin ver
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

// Kaan'ın manuel yaptığı "chunk" toplama ve JSON parse işlemini tek satırda yapar
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function initializeDatabase() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tc_id VARCHAR(11) UNIQUE,
      student_id VARCHAR(9) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'student'
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tc_id VARCHAR(11)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_tc_id_unique
    ON users (tc_id)
    WHERE tc_id IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS seat_number INT
  `);

  await pool.query(`
    ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  `);

  await pool.query(`
    INSERT INTO zones (name)
    VALUES ('1. Kat'), ('2. Kat'), ('3. Kat')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO desks (zone_id, desk_number)
    SELECT zones.id, desk_numbers.desk_number
    FROM zones
    CROSS JOIN generate_series(1, 15) AS desk_numbers(desk_number)
    WHERE zones.name IN ('1. Kat', '2. Kat', '3. Kat')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title VARCHAR(150) UNIQUE NOT NULL,
      author VARCHAR(150) NOT NULL,
      category VARCHAR(50) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_loans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      book_id INT REFERENCES books(id) ON DELETE CASCADE,
      borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      returned_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(20) DEFAULT 'active'
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS book_loans_one_active_per_book
    ON book_loans (book_id)
    WHERE status = 'active'
  `);

  await pool.query(`
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
        category = EXCLUDED.category
  `);

  const seedUsers = [
    {
      tcId: "10000000001",
      studentId: "900000001",
      password: "Admin1234",
      role: "admin",
    },
    {
      tcId: "10000000002",
      studentId: "900000002",
      password: "Ogrenci1234",
      role: "student",
    },
  ];

  for (const seedUser of seedUsers) {
    await pool.query(
      `
        INSERT INTO users (tc_id, student_id, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `,
      [
        seedUser.tcId,
        seedUser.studentId,
        await hashPassword(seedUser.password),
        seedUser.role,
      ],
    );
  }
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  if (!storedHash.startsWith("$argon2")) {
    return false;
  }

  return argon2.verify(storedHash, password);
}

async function verifyUserPassword(user, password) {
  if (await verifyPassword(password, user.password_hash)) {
    return true;
  }

  if (user.password === password || user.password_hash === password) {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      await hashPassword(password),
      user.id,
    ]);
    return true;
  }

  return false;
}

function isValidTcId(tcId) {
  return /^[0-9]{11}$/.test(tcId);
}

// 4. Öğrenci numarası doğrulaması
function isValidStudentId(studentId) {
  return /^[0-9]{9}$/.test(studentId);
}

function isValidFullName(fullName) {
  return /^[A-Za-zÇÖÜĞİçöüğı\s]{3,80}$/.test(fullName);
}

function isValidUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isValidPassword(password) {
  return /^(?=.*[A-Z]).{8,}$/.test(password);
}

function isValidComplaintMessage(message) {
  return (
    typeof message === "string" &&
    message.length >= 10 &&
    message.length <= 2000
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function createComplaintEmailHtml(complaint) {
  return `
    <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.55;">
      <h2 style="margin: 0 0 16px;">Yeni Şikayet / Öneri</h2>
      <p><strong>Ad Soyad:</strong> ${escapeHtml(complaint.fullName)}</p>
      <p><strong>Öğrenci No:</strong> ${escapeHtml(complaint.studentId)}</p>
      <p><strong>Konu:</strong> ${escapeHtml(complaint.topicLabel)}</p>
      <p><strong>Gönderim Tarihi:</strong> ${escapeHtml(complaint.sentAt)}</p>
      <hr style="border: 0; border-top: 1px solid #d7deea; margin: 18px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(complaint.message)}</p>
    </div>
  `;
}

function createComplaintEmailText(complaint) {
  return [
    "Yeni Şikayet / Öneri",
    "",
    `Ad Soyad: ${complaint.fullName}`,
    `Öğrenci No: ${complaint.studentId}`,
    `Konu: ${complaint.topicLabel}`,
    `Gönderim Tarihi: ${complaint.sentAt}`,
    "",
    "Mesaj:",
    complaint.message,
  ].join("\n");
}

async function sendComplaintEmail(complaint) {
  if (!COMPLAINT_EMAIL_PASS) {
    throw new Error("COMPLAINT_EMAIL_PASS eksik.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: COMPLAINT_EMAIL_USER,
      pass: COMPLAINT_EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Kütüphane Şikayet Formu" <${COMPLAINT_EMAIL_USER}>`,
    to: COMPLAINT_EMAIL_TO,
    subject: `Yeni şikayet/öneri: ${complaint.topicLabel}`,
    text: createComplaintEmailText(complaint),
    html: createComplaintEmailHtml(complaint),
  });
}

function getCookieValue(req, name) {
  const cookies = req.headers.cookie?.split(";") || [];
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));

  if (!cookie) {
    return "";
  }

  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

function getStudentIdFromRequest(req) {
  return (
    req.body?.studentId?.trim() ||
    req.query?.studentId?.trim() ||
    getCookieValue(req, "studentId").trim()
  );
}

async function getAuthenticatedUser(req) {
  const studentId = getStudentIdFromRequest(req);

  if (!studentId || !isValidStudentId(studentId)) {
    return null;
  }

  const result = await pool.query(
    "SELECT id, student_id, role FROM users WHERE student_id = $1",
    [studentId],
  );

  return result.rows[0] || null;
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ message: "Önce giriş yapmalısın." });
    }

    req.authUser = user;
    return next();
  } catch (error) {
    console.error("Kimlik doğrulama hatası:", error);
    return res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ message: "Önce giriş yapmalısın." });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Bu alana erişim yetkin yok." });
    }

    req.authUser = user;
    return next();
  } catch (error) {
    console.error("Admin yetkilendirme hatası:", error);
    return res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
}

function isValidFloor(floor) {
  return Number.isInteger(floor) && floor >= 1 && floor <= 3;
}

function isValidDeskNumber(deskNumber) {
  return Number.isInteger(deskNumber) && deskNumber >= 1 && deskNumber <= 15;
}

function isValidSeatNumber(seatNumber) {
  return Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= 4;
}

function isValidTimeValue(value) {
  return typeof value === "string" && /^[0-9]{2}:[0-9]{2}$/.test(value);
}

async function expireFinishedReservations() {
  await pool.query(`
    UPDATE reservations
    SET status = 'completed'
    WHERE status = 'active' AND end_time <= NOW()
  `);
}

async function getReservationTimes(req) {
  if (
    !isValidTimeValue(req.body.startTime) ||
    !isValidTimeValue(req.body.endTime)
  ) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        (((NOW() AT TIME ZONE 'Europe/Istanbul')::date + $1::time) AT TIME ZONE 'Europe/Istanbul') AS start_time,
        (((NOW() AT TIME ZONE 'Europe/Istanbul')::date + $2::time) AT TIME ZONE 'Europe/Istanbul') AS end_time
    `,
    [req.body.startTime, req.body.endTime],
  );

  const times = result.rows[0];

  if (new Date(times.end_time) <= new Date(times.start_time)) {
    return null;
  }

  if (new Date(times.end_time) <= new Date()) {
    return null;
  }

  return times;
}

// 5. API Endpoints (Rotalar)
app.post("/api/register", async (req, res) => {
  const tcId = req.body.tcId?.trim();
  const studentId = req.body.studentId?.trim();
  const { password } = req.body;

  if (!tcId || !studentId || !password) {
    return res
      .status(400)
      .json({ message: "TC Kimlik, öğrenci numarası ve şifre zorunludur." });
  }

  if (!isValidTcId(tcId)) {
    return res
      .status(400)
      .json({ message: "TC Kimlik tam olarak 11 haneli olmalıdır." });
  }

  if (!isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Öğrenci numarası tam olarak 9 haneli olmalıdır." });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      message:
        "Şifre en az 8 karakter olmalı ve en az 1 büyük harf içermelidir.",
    });
  }

  try {
    await pool.query(
      "INSERT INTO users (tc_id, student_id, password_hash) VALUES ($1, $2, $3)",
      [tcId, studentId, await hashPassword(password)],
    );

    res.status(201).json({ message: "Kayıt başarılı. Giriş yapabilirsin." });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Bu TC Kimlik veya öğrenci numarası zaten kayıtlı." });
    }

    console.error("Veritabanı Hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.post("/api/login", async (req, res) => {
  const studentId = req.body.studentId?.trim();
  const { password } = req.body;

  if (!studentId || !password) {
    return res
      .status(400)
      .json({ message: "Öğrenci numarası ve şifre zorunludur." });
  }

  if (!isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Öğrenci numarası tam olarak 9 haneli olmalıdır." });
  }

  try {
    // Veritabanı Sorgusu (SQL Injection'ı önlemek için parametrik sorgu [$1, $2] kullanıyoruz)
    const result = await pool.query(
      "SELECT id, student_id, role, password_hash FROM users WHERE student_id = $1",
      [studentId],
    );

    // Eğer eşleşen kayıt yoksa (Dönen satır sayısı 0 ise)
    if (
      result.rows.length === 0 ||
      !(await verifyUserPassword(result.rows[0], password))
    ) {
      return res
        .status(401)
        .json({ message: "Öğrenci numarası veya şifre yanlış." });
    }

    res.cookie("studentId", studentId, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    const role = result.rows[0].role || "student";

    res.status(200).json({
      message: "Giriş başarılı. Hoş geldin!",
      role,
      redirectTo:
        role === "admin" ? "/pages/admin-dashboard.html" : "/index.html",
    });
  } catch (error) {
    console.error("Veritabanı Hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/auth/me", requireAuthenticatedUser, (req, res) => {
  res.status(200).json({
    authenticated: true,
    user: req.authUser,
    redirectTo:
      req.authUser.role === "admin"
        ? "/pages/admin-dashboard.html"
        : "/index.html",
  });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("studentId", {
    path: "/",
    sameSite: "lax",
  });
  res.clearCookie("studentId", {
    path: "/api",
    sameSite: "lax",
  });
  res.status(200).json({ message: "Çıkış yapıldı." });
});

app.post("/api/complaints", async (req, res) => {
  const fullName = String(req.body.fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  const studentId = String(req.body.studentId || "").trim();
  const topic = String(req.body.topic || "").trim();
  const message = String(req.body.message || "").trim();
  const topicLabel = complaintTopicLabels[topic];

  if (!isValidFullName(fullName)) {
    return res.status(400).json({
      message:
        "Ad soyad yalnızca harf ve boşluk içermeli, 3-80 karakter olmalıdır.",
    });
  }

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Öğrenci numarası tam olarak 9 haneli olmalıdır." });
  }

  if (!topicLabel) {
    return res.status(400).json({ message: "Geçerli bir konu seçmelisin." });
  }

  if (!isValidComplaintMessage(message)) {
    return res.status(400).json({
      message: "Mesaj en az 10, en fazla 2000 karakter olmalıdır.",
    });
  }

  try {
    await sendComplaintEmail({
      fullName,
      studentId,
      topicLabel,
      message,
      sentAt: new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(new Date()),
    });

    res.status(200).json({ message: "Şikayetin başarıyla gönderildi." });
  } catch (error) {
    console.error("Şikayet e-posta gönderim hatası:", error);
    res.status(500).json({
      message:
        "Şikayet kaydedilemedi. E-posta ayarlarını kontrol edip tekrar deneyin.",
    });
  }
});

app.post("/api/reservations", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);
  const floor = Number(req.body.floor);
  const deskNumber = Number(req.body.deskNumber);
  const seatNumber = Number(req.body.seatNumber);

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  if (
    !isValidFloor(floor) ||
    !isValidDeskNumber(deskNumber) ||
    !isValidSeatNumber(seatNumber)
  ) {
    return res.status(400).json({ message: "Randevu bilgileri geçersiz." });
  }

  try {
    await expireFinishedReservations();

    const reservationTimes = await getReservationTimes(req);

    if (!reservationTimes) {
      return res
        .status(400)
        .json({ message: "Başlangıç ve bitiş saatleri geçerli olmalıdır." });
    }

    const userResult = await pool.query(
      "SELECT id FROM users WHERE student_id = $1",
      [studentId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const deskResult = await pool.query(
      `
        SELECT desks.id
        FROM desks
        INNER JOIN zones ON zones.id = desks.zone_id
        WHERE zones.name = $1 AND desks.desk_number = $2
      `,
      [`${floor}. Kat`, deskNumber],
    );

    if (deskResult.rows.length === 0) {
      return res.status(404).json({ message: "Masa bulunamadı." });
    }

    const userId = userResult.rows[0].id;
    const deskId = deskResult.rows[0].id;

    const activeUserReservation = await pool.query(
      `
        SELECT id
        FROM reservations
        WHERE user_id = $1
          AND status = 'active'
          AND end_time > NOW()
        LIMIT 1
      `,
      [userId],
    );

    if (activeUserReservation.rows.length > 0) {
      return res.status(409).json({
        message:
          "Zaten aktif bir randevun var. Önce mevcut randevunu iptal et.",
      });
    }

    const activeSeatReservation = await pool.query(
      `
        SELECT id
        FROM reservations
        WHERE desk_id = $1
          AND seat_number = $2
          AND status = 'active'
          AND end_time > NOW()
        LIMIT 1
      `,
      [deskId, seatNumber],
    );

    if (activeSeatReservation.rows.length > 0) {
      return res.status(409).json({ message: "Bu koltuk şu anda dolu." });
    }

    const reservationResult = await pool.query(
      `
        INSERT INTO reservations (user_id, desk_id, seat_number, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, start_time, end_time, status
      `,
      [
        userId,
        deskId,
        seatNumber,
        reservationTimes.start_time,
        reservationTimes.end_time,
      ],
    );

    res.status(201).json({
      message: "Randevu başarıyla kaydedildi.",
      reservation: reservationResult.rows[0],
    });
  } catch (error) {
    console.error("Randevu kayıt hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/reservations", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  try {
    await expireFinishedReservations();

    const result = await pool.query(
      `
        SELECT
          reservations.id,
          reservations.seat_number,
          reservations.start_time,
          reservations.end_time,
          reservations.status,
          zones.name AS floor,
          desks.desk_number
        FROM reservations
        INNER JOIN users ON users.id = reservations.user_id
        INNER JOIN desks ON desks.id = reservations.desk_id
        INNER JOIN zones ON zones.id = desks.zone_id
        WHERE users.student_id = $1
        ORDER BY reservations.created_at DESC, reservations.start_time DESC
      `,
      [studentId],
    );

    res.status(200).json({ reservations: result.rows });
  } catch (error) {
    console.error("Randevu listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/desks/availability", async (req, res) => {
  const floor = Number(req.query.floor);

  if (!isValidFloor(floor)) {
    return res.status(400).json({ message: "Kat bilgisi geçersiz." });
  }

  try {
    await expireFinishedReservations();

    const result = await pool.query(
      `
        SELECT desks.desk_number, reservations.seat_number
        FROM reservations
        INNER JOIN desks ON desks.id = reservations.desk_id
        INNER JOIN zones ON zones.id = desks.zone_id
        WHERE zones.name = $1
          AND reservations.status = 'active'
          AND reservations.end_time > NOW()
        ORDER BY desks.desk_number, reservations.seat_number
      `,
      [`${floor}. Kat`],
    );

    res.status(200).json({ occupiedSeats: result.rows });
  } catch (error) {
    console.error("Masa uygunluk hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.delete("/api/reservations/:id", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);
  const { id } = req.params;

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  try {
    const result = await pool.query(
      `
        UPDATE reservations
        SET status = 'cancelled'
        FROM users
        WHERE reservations.id = $1
          AND reservations.user_id = users.id
          AND users.student_id = $2
          AND reservations.status = 'active'
        RETURNING reservations.id
      `,
      [id, studentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Aktif randevu bulunamadı veya zaten iptal edilmiş.",
      });
    }

    res.status(200).json({ message: "Randevu iptal edildi." });
  } catch (error) {
    console.error("Randevu iptal hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/books", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        books.id,
        books.title,
        books.author,
        books.category,
        CASE WHEN book_loans.id IS NULL THEN 'uygun' ELSE 'dolu' END AS status
      FROM books
      LEFT JOIN book_loans
        ON book_loans.book_id = books.id
        AND book_loans.status = 'active'
      ORDER BY books.id
    `);

    res.status(200).json({ books: result.rows });
  } catch (error) {
    console.error("Kitap listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/book-loans", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          book_loans.id,
          book_loans.borrowed_at,
          book_loans.returned_at,
          book_loans.status,
          books.id AS book_id,
          books.title,
          books.author,
          books.category
        FROM book_loans
        INNER JOIN users ON users.id = book_loans.user_id
        INNER JOIN books ON books.id = book_loans.book_id
        WHERE users.student_id = $1
        ORDER BY
          CASE WHEN book_loans.status = 'active' THEN 0 ELSE 1 END,
          book_loans.borrowed_at DESC
      `,
      [studentId],
    );

    res.status(200).json({ loans: result.rows });
  } catch (error) {
    console.error("Kitaplarım listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.post("/api/book-loans", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);
  const bookIds = Array.isArray(req.body.bookIds)
    ? [
      ...new Set(
        req.body.bookIds
          .map(Number)
          .filter((bookId) => Number.isInteger(bookId) && bookId > 0),
      ),
    ]
    : [];
  const bookTitles = Array.isArray(req.body.bookTitles)
    ? [
      ...new Set(
        req.body.bookTitles
          .map((title) => String(title).trim())
          .filter(Boolean),
      ),
    ]
    : [];
  const selectedBookCount = bookTitles.length || bookIds.length;

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  if (selectedBookCount === 0 || selectedBookCount > 3) {
    return res
      .status(400)
      .json({ message: "En az 1, en fazla 3 kitap seçebilirsin." });
  }

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE student_id = $1",
      [studentId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const unavailableResult = await pool.query(
      `
        WITH selected_books AS (
          SELECT id, title
          FROM books
          WHERE id = ANY($1::int[]) OR title = ANY($2::text[])
        )
        SELECT selected_books.title
        FROM selected_books
        INNER JOIN book_loans
          ON book_loans.book_id = selected_books.id
          AND book_loans.status = 'active'
      `,
      [bookIds, bookTitles],
    );

    if (unavailableResult.rows.length > 0) {
      return res.status(409).json({
        message: "Seçtiğin kitaplardan biri zaten ödünç alınmış.",
      });
    }

    const loanResult = await pool.query(
      `
        WITH selected_books AS (
          SELECT id
          FROM books
          WHERE id = ANY($2::int[]) OR title = ANY($3::text[])
        )
        INSERT INTO book_loans (user_id, book_id)
        SELECT $1, selected_books.id
        FROM selected_books
        RETURNING id, book_id, borrowed_at, status
      `,
      [userResult.rows[0].id, bookIds, bookTitles],
    );

    if (loanResult.rows.length !== selectedBookCount) {
      return res
        .status(404)
        .json({ message: "Seçilen kitaplardan bazıları bulunamadı." });
    }

    res.status(201).json({
      message: "Kitaplar başarıyla ödünç alındı.",
      loans: loanResult.rows,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Seçtiğin kitaplardan biri zaten ödünç alınmış.",
      });
    }

    console.error("Kitap alma hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.delete("/api/book-loans/:id", async (req, res) => {
  const studentId = getStudentIdFromRequest(req);
  const { id } = req.params;

  if (!studentId || !isValidStudentId(studentId)) {
    return res
      .status(400)
      .json({ message: "Geçerli bir öğrenci numarası gereklidir." });
  }

  if (!isValidUuid(id)) {
    return res.status(400).json({ message: "Kitap kaydı geçersiz." });
  }

  try {
    const result = await pool.query(
      `
        UPDATE book_loans
        SET status = 'cancelled',
            returned_at = NOW()
        FROM users
        WHERE book_loans.id = $1
          AND book_loans.user_id = users.id
          AND users.student_id = $2
          AND book_loans.status = 'active'
        RETURNING book_loans.id
      `,
      [id, studentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Aktif kitap ödünç kaydı bulunamadı veya zaten iptal edilmiş.",
      });
    }

    res.status(200).json({ message: "Kitap ödünç işlemi iptal edildi." });
  } catch (error) {
    console.error("Kitap ödünç iptal hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

// 6. Admin Endpoints
app.use("/api/admin", requireAdmin);

app.get("/api/admin/dashboard", async (req, res) => {
  try {
    const totalBooksResult = await pool.query("SELECT COUNT(*) as count FROM books");
    const totalUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const activeBooksResult = await pool.query(
      "SELECT COUNT(*) as count FROM book_loans WHERE status = 'active'"
    );
    const overdueLoansResult = await pool.query(
      `SELECT COUNT(*) as count FROM book_loans 
       WHERE status = 'active' AND DATE(NOW()) > DATE(borrowed_at + INTERVAL '15 days')`
    );

    res.status(200).json({
      totalBooks: parseInt(totalBooksResult.rows[0].count),
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      activeLoans: parseInt(activeBooksResult.rows[0].count),
      overdueLoans: parseInt(overdueLoansResult.rows[0].count),
    });
  } catch (error) {
    console.error("Dashboard verisi hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/admin/books", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        books.id,
        books.title,
        books.author,
        books.category,
        CASE WHEN book_loans.id IS NULL THEN 'Rafta' ELSE 'Ödünçte' END AS status,
        COUNT(book_loans.id) as loan_count
      FROM books
      LEFT JOIN book_loans ON book_loans.book_id = books.id AND book_loans.status = 'active'
      GROUP BY books.id, books.title, books.author, books.category, book_loans.id
      ORDER BY books.title ASC
    `);

    res.status(200).json({ books: result.rows });
  } catch (error) {
    console.error("Admin kitapları listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.post("/api/admin/books", async (req, res) => {
  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const category = String(req.body.category || "").trim();

  if (!title || !author || !category) {
    return res.status(400).json({ message: "Başlık, yazar ve kategori zorunludur." });
  }

  if (title.length < 3 || title.length > 150) {
    return res.status(400).json({ message: "Başlık 3-150 karakter olmalıdır." });
  }

  if (author.length < 3 || author.length > 150) {
    return res.status(400).json({ message: "Yazar adı 3-150 karakter olmalıdır." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO books (title, author, category) VALUES ($1, $2, $3) RETURNING *",
      [title, author, category]
    );

    res.status(201).json({ message: "Kitap başarıyla eklendi.", book: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Bu başlıkta kitap zaten var." });
    }
    console.error("Kitap ekleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.put("/api/admin/books/:id", async (req, res) => {
  const bookId = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const category = String(req.body.category || "").trim();

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({ message: "Geçersiz kitap ID." });
  }

  if (!title || !author || !category) {
    return res.status(400).json({ message: "Başlık, yazar ve kategori zorunludur." });
  }

  try {
    const result = await pool.query(
      "UPDATE books SET title = $1, author = $2, category = $3 WHERE id = $4 RETURNING *",
      [title, author, category, bookId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Kitap bulunamadı." });
    }

    res.status(200).json({ message: "Kitap başarıyla güncellendi.", book: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Bu başlıkta kitap zaten var." });
    }
    console.error("Kitap güncelleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.delete("/api/admin/books/:id", async (req, res) => {
  const bookId = Number(req.params.id);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({ message: "Geçersiz kitap ID." });
  }

  try {
    const hasLoans = await pool.query(
      "SELECT COUNT(*) as count FROM book_loans WHERE book_id = $1",
      [bookId]
    );

    if (parseInt(hasLoans.rows[0].count) > 0) {
      return res.status(409).json({ message: "Ödünç kayıtları olan kitapları silemezsiniz." });
    }

    const result = await pool.query("DELETE FROM books WHERE id = $1 RETURNING id", [bookId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Kitap bulunamadı." });
    }

    res.status(200).json({ message: "Kitap başarıyla silindi." });
  } catch (error) {
    console.error("Kitap silme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/admin/members", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        users.id,
        users.student_id,
        users.tc_id,
        COUNT(book_loans.id) as total_loans,
        COUNT(CASE WHEN book_loans.status = 'active' THEN 1 END) as active_loans
      FROM users
      LEFT JOIN book_loans ON book_loans.user_id = users.id
      WHERE users.role = 'student'
      GROUP BY users.id, users.student_id, users.tc_id
      ORDER BY users.student_id ASC
    `);

    res.status(200).json({ members: result.rows });
  } catch (error) {
    console.error("Üyeleri listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/admin/members/:id", async (req, res) => {
  const userId = req.params.id;

  if (!isValidUuid(userId)) {
    return res.status(400).json({ message: "Geçersiz kullanıcı ID." });
  }

  try {
    const userResult = await pool.query("SELECT id, student_id, tc_id FROM users WHERE id = $1", [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const loansResult = await pool.query(
      `
        SELECT
          book_loans.id,
          book_loans.borrowed_at,
          book_loans.returned_at,
          book_loans.status,
          books.title,
          books.author
        FROM book_loans
        INNER JOIN books ON books.id = book_loans.book_id
        WHERE book_loans.user_id = $1
        ORDER BY book_loans.borrowed_at DESC
      `,
      [userId]
    );

    res.status(200).json({ user: userResult.rows[0], loans: loansResult.rows });
  } catch (error) {
    console.error("Üye detay hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.get("/api/admin/loans", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        book_loans.id,
        book_loans.borrowed_at,
        book_loans.returned_at,
        book_loans.status,
        users.student_id,
        books.title,
        books.author,
        CASE WHEN DATE(NOW()) > DATE(book_loans.borrowed_at + INTERVAL '15 days') AND book_loans.status = 'active'
          THEN true ELSE false END AS is_overdue
      FROM book_loans
      INNER JOIN users ON users.id = book_loans.user_id
      INNER JOIN books ON books.id = book_loans.book_id
      ORDER BY book_loans.borrowed_at DESC
    `);

    res.status(200).json({ loans: result.rows });
  } catch (error) {
    console.error("Ödünç listeleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.put("/api/admin/loans/:id", async (req, res) => {
  const loanId = req.params.id;
  const status = String(req.body.status || "").trim();

  if (!isValidUuid(loanId)) {
    return res.status(400).json({ message: "Geçersiz ödünç ID." });
  }

  if (!["active", "returned", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Geçersiz durum." });
  }

  try {
    const result = await pool.query(
      `UPDATE book_loans SET status = $1, returned_at = CASE WHEN $1 != 'active' THEN NOW() ELSE returned_at END
       WHERE id = $2 RETURNING *`,
      [status, loanId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ödünç kaydı bulunamadı." });
    }

    res.status(200).json({ message: "Ödünç işlemi güncellendi.", loan: result.rows[0] });
  } catch (error) {
    console.error("Ödünç güncelleme hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

// 7. Sunucuyu Ayağa Kaldırma
initializeDatabase()
  .then(() => {
    setInterval(() => {
      expireFinishedReservations().catch((error) => {
        console.error("Süresi biten randevu temizleme hatası:", error);
      });
    }, 60 * 1000);

    app.listen(PORT, () => {
      console.log(`Express sunucusu çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Veritabanı başlatılamadı:", error);
    process.exit(1);
  });
