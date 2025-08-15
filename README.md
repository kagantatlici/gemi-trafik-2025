# Firebase Migration - İstanbul Boğazı Gemi Trafik

## Kurulum ve Deploy Adımları

### 1. Gerekli Araçları Kur
```bash
# Node.js zaten kurulu ise geç
# Firebase CLI'ı kur
npm install -g firebase-tools
```

### 2. Firebase'e Giriş Yap
```bash
firebase login
```

### 3. Firebase Projesini Başlat
```bash
# Bu dizinde çalıştır
firebase init

# Seçenekler:
# ✅ Functions: Configure a Cloud Functions directory
# ✅ Hosting: Configure files for Firebase Hosting
# 
# Mevcut proje seç veya yeni oluştur
# Functions: JavaScript, ESLint hayır
# Hosting: public klasör, single-page app HAYIR
```

### 4. Dependencies'leri Kur
```bash
cd functions
npm install
cd ..
```

### 5. Deploy Et
```bash
# İlk deploy (her şey)
firebase deploy

# Sadece functions
firebase deploy --only functions

# Sadece hosting
firebase deploy --only hosting
```

### 6. Local Test (Opsiyonel)
```bash
# Local emulator çalıştır
firebase emulators:start
```

## Değişen Tek Şey

- `google.script.run.fetchAllShipData()` → `fetch('/api/fetchAllShipData')`
- Tüm mantık aynı kaldı!

## Sorun Giderme

- İlk yükleme 2-3 saniye sürebilir (cold start)
- Firebase Console'dan logları kontrol et
- CORS sorunu olursa functions/index.js'te `cors: true` var