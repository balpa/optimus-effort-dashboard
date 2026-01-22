# 🚀 Vercel + GitHub Actions Deployment Guide

Bu proje **tamamen ücretsiz** olarak Vercel (Dashboard) ve GitHub Actions (Cronjob) ile production ortamında çalışacak şekilde yapılandırılmıştır.

## 📋 Mimari

- **Dashboard Hosting**: Vercel (Ücretsiz)
- **Haftalık Data Güncelleme**: GitHub Actions (Ücretsiz)
- **Data Storage**: GitHub Repository (Ücretsiz)

## 🚀 Deployment Adımları

### 1️⃣ GitHub Repository Secrets Ekle

Repository'de **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

```
JIRA_AUTH_TOKEN=your_jira_basic_auth_token
JIRA_BASE_URL=https://your-domain.atlassian.net/rest/api/3/search/jql
JIRA_PROJECT=OPT
```

### 2️⃣ Vercel'e Deploy Et

#### A. Vercel Hesabı Oluştur
1. [vercel.com](https://vercel.com) adresine git
2. GitHub hesabınla giriş yap

#### B. Projeyi Import Et
1. Vercel Dashboard'da **Add New** → **Project**
2. GitHub repository'i seç: `balpa/optimus-effort-dashboard`
3. **Import** tıkla

#### C. Environment Variables Ekle
Vercel proje ayarlarında **Settings** → **Environment Variables**:

```
JIRA_AUTH_TOKEN=your_jira_basic_auth_token
JIRA_BASE_URL=https://your-domain.atlassian.net/rest/api/3/search/jql
JIRA_PROJECT=OPT
DASHBOARD_PORT=3001
```

#### D. Deploy Settings
Vercel otomatik algılayacak ama kontrol et:
- **Framework Preset**: Other
- **Build Command**: `npm run build` (veya boş bırak)
- **Output Directory**: boş bırak
- **Install Command**: `npm install`

#### E. Deploy!
**Deploy** butonuna tıkla. Birkaç saniye içinde dashboard hazır olacak!

## ⏰ GitHub Actions Cronjob (Otomatik Her Pazartesi)

### Nasıl Çalışır?

`.github/workflows/weekly-update.yml` dosyası:
- ✅ Her Pazartesi saat 09:00 UTC (Türkiye 12:00) otomatik çalışır
- ✅ Jira'dan güncel data çeker
- ✅ Analiz yapar
- ✅ `data/` klasörüne kaydeder
- ✅ GitHub'a otomatik commit atar

### Manuel Çalıştırma

GitHub repository'de:
1. **Actions** sekmesine git
2. **Weekly Data Update** workflow'u seç
3. **Run workflow** → **Run workflow** butonuna tıkla

### Workflow Durumunu Kontrol

**Actions** sekmesinde tüm cronjob çalışmalarını görebilirsin:
- ✅ Yeşil check: Başarılı
- ❌ Kırmızı X: Hata var
- Detaylar için tıkla ve log'ları incele

## 📊 Dashboard'a Erişim

Deploy edildikten sonra Vercel size bir URL verecek:
```
https://optimus-effort-dashboard.vercel.app
```

Kendi domain'i de bağlayabilirsin (ücretsiz):
**Vercel Project Settings** → **Domains**

## 🔄 Otomatik Güncellemeler

### Data Güncellemeleri
- GitHub Actions her Pazartesi otomatik data günceller
- Vercel her commit'te otomatik deploy eder
- Dashboard her zaman güncel data gösterir

### Kod Değişiklikleri
```bash
git add .
git commit -m "Update dashboard"
git push origin main
```

Vercel otomatik olarak yeni versiyonu deploy edecek (~30 saniye)

## 📁 Dosya Yapısı

Vercel + GitHub Actions için eklenen dosyalar:

```
optimus-effort-dashboard/
├── .github/
│   └── workflows/
│       └── weekly-update.yml    # Haftalık cronjob
├── vercel.json                  # Vercel konfigürasyonu
├── .vercelignore               # Deploy'dan hariç tutulan dosyalar
├── scripts/
│   └── weekly-update.js        # Cronjob script'i
└── package.json                # build ve dev scriptleri eklendi
```

## 🔐 Güvenlik

- ✅ Tüm credentials GitHub Secrets'ta
- ✅ `.env` dosyası deploy edilmiyor
- ✅ `google-credentials.json` deploy edilmiyor
- ✅ `data/` klasörü GitHub'da ama sadece JSON/TXT dosyaları

## 🎯 Avantajlar

| Özellik | Maliyet | Limit |
|---------|---------|-------|
| Vercel Hosting | Ücretsiz | 100 GB bant genişliği/ay |
| GitHub Actions | Ücretsiz | 2000 dakika/ay (public repo için sınırsız) |
| Custom Domain | Ücretsiz | ✅ |
| SSL Certificate | Ücretsiz | ✅ |
| Auto Deploy | Ücretsiz | ✅ |
| Scheduled Cron | Ücretsiz | ✅ |

## 🚨 Troubleshooting

### Vercel Deploy Hatası
1. Vercel Dashboard → Project → **Deployments**
2. Failed deployment'a tıkla
3. **Build Logs** kontrol et
4. Environment variables doğru mu?

### GitHub Actions Cronjob Çalışmıyor
1. **Actions** sekmesinde workflow durumunu kontrol et
2. Secrets doğru eklenmiş mi?
3. Repository permissions: **Settings** → **Actions** → **General** → **Workflow permissions** → "Read and write permissions" seçili olmalı

### Data Güncellenmiyor
1. GitHub Actions log'larını kontrol et
2. JIRA credentials geçerli mi?
3. `data/` klasöründe dosyalar var mı?

### Dashboard Açılmıyor
1. Vercel Dashboard'da deployment status kontrol et
2. Domain doğru mu?
3. Environment variables set edilmiş mi?

## 🛠️ Local Development

```bash
# Dependencies
npm install

# Start dashboard locally
npm start

# Manuel data update
npm run weekly-update

# Test specific scripts
npm run analyze        # DEV mode analizi
npm run analyze:qa     # QA mode analizi
npm run fetch-current  # Sadece güncel ay
```

## 📈 Monitoring

### Vercel Analytics (Ücretsiz)
Vercel Dashboard → Project → **Analytics**:
- Page views
- Visitor stats
- Performance metrics

### GitHub Actions Status Badge
README'ye eklemek için:

```markdown
![Weekly Update](https://github.com/balpa/optimus-effort-dashboard/actions/workflows/weekly-update.yml/badge.svg)
```

## 🔄 Workflow Timeline

```
Pazartesi 09:00 UTC (12:00 Türkiye)
    ↓
GitHub Actions tetiklenir
    ↓
Jira'dan data çekilir
    ↓
Analiz yapılır
    ↓
data/*.json ve data/*.txt güncellenir
    ↓
GitHub'a commit atılır
    ↓
Vercel otomatik deploy eder
    ↓
Dashboard güncel data ile hazır! ✅
```

## 💡 İpuçları

1. **İlk Deploy Sonrası**: Manuel olarak `npm run weekly-update` çalıştır veya GitHub Actions'dan tetikle
2. **Test**: GitHub Actions'ı manuel tetikleyerek test edebilirsin
3. **Logs**: Her cronjob çalışmasının detaylı log'u GitHub Actions'da saklanır
4. **Notifications**: GitHub'dan email notification alabilirsin (Settings → Notifications)

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- GitHub Actions Docs: https://docs.github.com/actions
- Sorular için issue aç!

---

**🎉 Tamamen ücretsiz, sınırsız kullanım! Railway'e göre çok daha iyi! 🚀**
