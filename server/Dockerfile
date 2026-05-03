# 1. Base Image: En güncel LTS Node.js sürümü (Krypton)
FROM node:24-alpine

# 2. Çalışma Dizini: Konteyner içindeki izole uygulama klasörü
WORKDIR /usr/src/app

# 3. Önbellek Optimizasyonu (Caching): Önce sadece paket listesini kopyala
COPY package*.json ./

# Sadece production (canlı) ortamı için gereken bağımlılıkları kur
RUN npm install --omit=dev

# 4. Kaynak Kodun Aktarımı: Kalan tüm dosyaları içeri kopyala
COPY . .

# 5. Güvenlik Katmanı (Least Privilege): 
# Konteyneri root (süper yönetici) yerine yetkileri kısıtlanmış varsayılan "node" kullanıcısı ile çalıştır
USER node

# 6. İletişim Portu: Uygulamanın dinleyeceği iç port
EXPOSE 3000

# 7. Başlatma Komutu: Sistemi ayağa kaldıran ana tetikleyici
CMD ["node", "index.js"]