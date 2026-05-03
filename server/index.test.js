import express, { json } from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// 1. CORS Güvenliği
app.use(cors({
  origin: 'https://library.zeuleg.dev',
  credentials: true
}));

app.use(json());

// 2. Veritabanı Bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3. Health Check
app.get('/api/health', async (req, res) => {
  try {
    // init.sql ile eklediğimiz verileri çekerek veritabanını test ediyoruz
    const dbResult = await pool.query('SELECT name FROM zones LIMIT 2');

    res.status(200).json({
      status: 'success',
      message: 'Backend ayakta ve veritabanına bağlı!',
      zones: dbResult.rows, // Beklenen çıktı: [{name: '1. Kat'}, {name: '2. Kat'}]
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Veritabanı hatası:', error);
    res.status(500).json({
      status: 'error',
      message: 'Veritabanı bağlantısı koptu.'
    });
  }
});

app.listen(port, () => {
  console.log(`API Sunucusu ${port} portunda çalışıyor.`);
});