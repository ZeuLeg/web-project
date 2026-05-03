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
    CREATE UNIQUE INDEX IF NOT EXISTS users_tc_id_unique
    ON users (tc_id)
    WHERE tc_id IS NOT NULL
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

  return argon2.verify(storedHash, password);
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

// 5. API Endpoints (Rotalar)
app.post("/api/register", async (req, res) => {
  const { tcId, studentId, password } = req.body;

  if (!tcId || !studentId || !password) {
    return res.status(400).json({ message: "TC Kimlik, öğrenci numarası ve şifre zorunludur." });
  }

  if (!isValidTcId(tcId)) {
    return res.status(400).json({ message: "TC Kimlik tam olarak 11 haneli olmalıdır." });
  }

  if (!isValidStudentId(studentId)) {
    return res.status(400).json({ message: "Öğrenci numarası tam olarak 9 haneli olmalıdır." });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: "Şifre en az 8 karakter olmalı ve en az 1 büyük harf içermelidir." });
  }

  try {
    await pool.query(
      "INSERT INTO users (tc_id, student_id, password_hash) VALUES ($1, $2, $3)",
      [tcId, studentId, await hashPassword(password)],
    );

    res.status(201).json({ message: "Kayıt başarılı. Giriş yapabilirsin." });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Bu TC Kimlik veya öğrenci numarası zaten kayıtlı." });
    }

    console.error("Veritabanı Hatası:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

app.post("/api/login", async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res.status(400).json({ message: "Öğrenci numarası ve şifre zorunludur." });
  }

  if (!isValidStudentId(studentId)) {
    return res.status(400).json({ message: "Öğrenci numarası tam olarak 9 haneli olmalıdır." });
  }

  try {
    // Veritabanı Sorgusu (SQL Injection'ı önlemek için parametrik sorgu [$1, $2] kullanıyoruz)
    const result = await pool.query(
      "SELECT * FROM users WHERE student_id = $1",
      [studentId],
    );

    // Eğer eşleşen kayıt yoksa (Dönen satır sayısı 0 ise)
    if (result.rows.length === 0 || !(await verifyPassword(password, result.rows[0].password_hash))) {
      return res.status(401).json({ message: "Öğrenci numarası veya şifre yanlış." });
    }

    res.status(200).json({ message: "Giriş başarılı. Hoş geldin!" });
  } catch (error) {
    console.error("Veritabanı Hatası:", error);
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
