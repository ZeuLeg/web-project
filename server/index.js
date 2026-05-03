import express from "express";
import pkg from "pg";
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
    connectionString: process.env.DATABASE_URL
});

// 3. Middlewares (Ara Katmanlar)
// Kaan'ın manuel yaptığı "chunk" toplama ve JSON parse işlemini tek satırda yapar
app.use(express.json());

// Kaan'ın yazdığı serveStatic fonksiyonunun (MIME tipleri dahil) tek satırlık tam karşılığı
app.use(express.static(CLIENT_DIR));

// 4. Güvenlik: Atatürk Üniversitesi Öğrenci Numarası Doğrulaması
function isValidStudentId(studentId) {
    return /^[0-9]{2}0709[0-9]{3}$/.test(studentId);
}

// 5. API Endpoints (Rotalar)
app.post("/api/login", async (req, res) => {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
        return res.status(400).json({ message: "Öğrenci ID ve şifre zorunludur." });
    }

    if (!isValidStudentId(studentId)) {
        return res.status(400).json({ message: "Öğrenci ID formatı hatalı." });
    }

    try {
        // Veritabanı Sorgusu (SQL Injection'ı önlemek için parametrik sorgu [$1, $2] kullanıyoruz)
        const result = await pool.query(
            "SELECT * FROM users WHERE student_id = $1 AND password = $2",
            [studentId, password]
        );

        // Eğer eşleşen kayıt yoksa (Dönen satır sayısı 0 ise)
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Öğrenci ID veya şifre yanlış." });
        }

        res.status(200).json({ message: "Giriş başarılı. Hoş geldin!" });
    } catch (error) {
        console.error("Veritabanı Hatası:", error);
        res.status(500).json({ message: "Sunucu hatası oluştu." });
    }
});

// 6. Sunucuyu Ayağa Kaldırma
app.listen(PORT, () => {
    console.log(`Express sunucusu çalışıyor: http://localhost:${PORT}`);
});