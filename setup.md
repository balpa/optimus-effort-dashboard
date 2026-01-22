# Google Sheets API Kurulumu

Bu script'in Google Sheets'e veri yükleyebilmesi için aşağıdaki adımları takip edin:

## 0. Gerekli Paketleri Yükleyin

```bash
npm install googleapis
```

veya

```bash
yarn add googleapis
```

## 1. Google Cloud Console'da Proje Oluşturun

1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Yeni bir proje oluşturun veya mevcut bir projeyi seçin

## 2. Google Sheets API'yi Etkinleştirin

1. Sol menüden "APIs & Services" > "Library" seçin
2. "Google Sheets API" aratın
3. "Enable" butonuna tıklayın

## 3. Service Account Oluşturun

1. "APIs & Services" > "Credentials" seçin
2. "Create Credentials" > "Service Account" seçin
3. Service account detaylarını doldurun (ör: "sheets-uploader")
4. "Create and Continue" tıklayın
5. Role olarak "Editor" seçin (veya "Google Sheets" için özel bir role)
6. "Done" tıklayın

## 4. Service Account Key'i İndirin

1. Oluşturduğunuz service account'a tıklayın
2. "Keys" sekmesine gidin
3. "Add Key" > "Create new key" seçin
4. JSON formatını seçin
5. Key indirilecek - bu dosyayı `google-credentials.json` olarak tasks klasörüne kaydedin

## 5. Google Sheets'i Paylaşın

1. Kullanmak istediğiniz Google Sheets dosyasını açın
2. "Share" butonuna tıklayın
3. Service account email adresinizi ekleyin (ör: `sheets-uploader@your-project.iam.gserviceaccount.com`)
4. "Editor" yetkisi verin
5. Google Sheets URL'sinden Spreadsheet ID'yi kopyalayın:
   - URL formatı: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - SPREADSHEET_ID kısmını kopyalayın

## 6. Script'i Güncelleyin

`story-point-2-to-higher.js` dosyasındaki aşağıdaki satırı güncelleyin:

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

Buraya kopyaladığınız Spreadsheet ID'yi yapıştırın.

## 7. Çalıştırın

```bash
node story-point-2-to-higher.js
```

Script, verileri hem dosyalara kayedecek hem de Google Sheets'e yükleyecektir.

## Güvenlik Notu

⚠️ `google-credentials.json` dosyasını **asla** Git'e commit etmeyin!

`.gitignore` dosyanıza ekleyin:
```
google-credentials.json
node_modules/
*.txt
*.json
!package.json
```

---

## Dashboard Kullanımı

Analiz sonuçlarını interaktif bir dashboard'da görüntülemek için:

```bash
npm run dashboard
```

veya

```bash
node dashboard.js
```

Dashboard şu adreste açılacak: `http://localhost:3000`

### Dashboard'u İnternet Üzerinden Paylaşma (ngrok)

Dashboard'unuzu internet üzerinden erişilebilir yapmak için ngrok kullanabilirsiniz:

```bash
npm run ngrok
```

veya

```bash
npm run tunnel
```

Bu komut:
1. Dashboard'u port 3000'de başlatır (zaten çalışıyorsa skip eder)
2. ngrok tunnel'ı açar ve public URL verir
3. URL'i herhangi biriyle paylaşabilirsiniz

**Örnek ngrok URL:** `https://abc123.ngrok-free.app`

### Dashboard Özellikleri:

1. **📈 Overview Tab**
   - Aylık trend grafikleri
   - Hedef story point dağılımı
   - Detaylı tablo görünümü

2. **📋 Details Tab**
   - Her ay için detaylı breakdown
   - Issue key'lere tıklanabilir linkler
   - Hedef değere göre gruplandırma

3. **📄 Full Report Tab**
   - `story-point-2-to-higher-report.txt` dosyasının tam içeriği
   - Kolay okuma ve kopyalama

### Kullanım Adımları:

1. Önce analizi çalıştır: `npm run analyze` (veya `node script.js`)
2. Dashboard'u başlat: `npm run dashboard` (veya `node dashboard.js`)
3. Tarayıcıda `http://localhost:3000` adresine git
4. Verileri görselleştir ve analiz et
