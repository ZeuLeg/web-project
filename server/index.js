import express from "express";
import pkg from "pg";
import argon2 from "argon2";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 1. ESM (Module) ortamı için __dirname çözümlemesi
const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = join(__dirname, "..", "client");
const { Pool } = pkg;

const app = express();

// 2. PostgreSQL Veritabanı Bağlantı Havuzu (Pool)
// docker-compose.yml içerisindeki DATABASE_URL değişkenini otomatik okur
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3. Middlewares (Ara Katmanlar)
// Kaan'ın manuel yaptığı "chunk" toplama ve JSON parse işlemini tek satırda yapar
app.use(express.json());

// Kaan'ın yazdığı serveStatic fonksiyonunun (MIME tipleri dahil) tek satırlık tam karşılığı
app.use(express.static(CLIENT_DIR));

async function initializeDatabase() {
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

function isValidPassword(password) {
  return /^(?=.*[A-Z]).{8,}$/.test(password);
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

function isValidFloor(floor) {
  return Number.isInteger(floor) && floor >= 1 && floor <= 3;
}

function isValidDeskNumber(deskNumber) {
  return Number.isInteger(deskNumber) && deskNumber >= 1 && deskNumber <= 15;
}

function isValidSeatNumber(seatNumber) {
  return Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= 4;
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
      "SELECT * FROM users WHERE student_id = $1",
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

    res.status(200).json({ message: "Giriş başarılı. Hoş geldin!" });
  } catch (error) {
    console.error("Veritabanı Hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
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
      "SELECT id FROM reservations WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId],
    );

    if (activeUserReservation.rows.length > 0) {
      return res.status(409).json({
        message:
          "Zaten aktif bir randevun var. Önce mevcut randevunu iptal et.",
      });
    }

    const activeSeatReservation = await pool.query(
      "SELECT id FROM reservations WHERE desk_id = $1 AND seat_number = $2 AND status = 'active' LIMIT 1",
      [deskId, seatNumber],
    );

    if (activeSeatReservation.rows.length > 0) {
      return res.status(409).json({ message: "Bu koltuk şu anda dolu." });
    }

    const reservationResult = await pool.query(
      `
        INSERT INTO reservations (user_id, desk_id, seat_number, start_time, end_time)
        VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '2 hours')
        RETURNING id, start_time, end_time, status
      `,
      [userId, deskId, seatNumber],
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

// 6. Sunucuyu Ayağa Kaldırma
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Express sunucusu çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Veritabanı başlatılamadı:", error);
    process.exit(1);
  });
