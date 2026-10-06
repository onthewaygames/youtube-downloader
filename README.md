# 🎬 YouTube Downloader & Playlist Studio

Dieter Rams ve Teenage Engineering endüstriyel estetiğinden ilham alan; çoklu YouTube linki indirme, MP4/MP3 format dönüşümü ve dinamik çalma listesi (playlist) klasörleme sistemi sunan bağımsız yerel web uygulaması.

---

## ⚡ Temel Özellikler

- **Çoklu Link Kuyruğu (Varsayılan 6 Sıra):** Açılışta hazır 6 link yuvası ile gelir. Tek tıkla yeni sıralar eklenebilir.
- **Toplu Link Yapıştırma (Bulk Paste):** Kopyalanan onlarca YouTube linkini tek bir pencereye yapıştırıp anında sıralara dağıtabilme.
- **MP4 & MP3 Desteği:**
  - MP4 — En Yüksek Kalite (Video + Ses birleştirme)
  - MP4 — 1080p Full HD
  - MP4 — 720p HD
  - MP3 — 320 kbps Saf Ses
- **Dinamik Çalma Listesi (Playlist) Yönetimi:**
  - Yan panelden yeni çalma listeleri oluşturma.
  - İndirmeleri doğrudan seçili playlist klasörüne (`downloads/<Playlist_Adı>/`) yönlendirme.
- **⚡ Listeden Listeyi Çek / Taşı (Auto-Organize):**
  - İndirilen dağınık dosyaları tek tıkla tarayıp hedef çalma listesi klasörüne taşıma ve organize etme.
- **Windows Gezgini Entegrasyonu:** Web arayüzünden doğrudan klasörü Windows Explorer üzerinde açma butonu.
- **Yerel ve Hızlı:** Sıfır harici servis bağımlılığı; doğrudan yerel `yt-dlp` ve `ffmpeg` motoru.

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Python 3.10+
- `yt-dlp` (`pip install yt-dlp`)
- FFmpeg (`bin/ffmpeg.exe` ve `bin/ffprobe.exe` klasör içine yerleştirilmiştir)

### Çalıştırma

1. Proje dizinindeki `BASLAT.bat` dosyasına çift tıklayın.
2. Veya terminalden:
   ```bash
   python server.py
   ```
3. Tarayıcınızda otomatik olarak açılır: `http://localhost:5050`

---

## 📁 Dizin Yapısı

```
youtube_downloader/
├── bin/                    # FFmpeg ve FFprobe ikili dosyaları
│   ├── ffmpeg.exe
│   └── ffprobe.exe
├── downloads/              # İndirilen videolar ve Playlist alt klasörleri
├── index.html              # Modern web arayüzü
├── style.css               # Koyu endüstriyel tasarım sistemi
├── app.js                  # Frontend dinamik kontrolleri & API entegrasyonu
├── server.py               # Python Threaded HTTP & yt-dlp API sunucusu
├── BASLAT.bat              # Tek tıkla başlatıcı
├── .gitignore
└── README.md
```

---

## 🛠️ API Uç Noktaları

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/playlists` | Mevcut çalma listelerini ve dosya sayılarını listeler |
| `POST` | `/api/playlists` | Yeni bir çalma listesi (klasör) oluşturur |
| `POST` | `/api/download` | Verilen URL'yi belirtilen playlist ve formatta indirir |
| `GET` | `/api/progress?id=X` | İndirme görev durumunu ve anlık yüzdesini döner |
| `POST` | `/api/organize` | Kök dizindeki dosyaları hedef çalma listesine taşır |
| `POST` | `/api/open-folder` | İlgili klasörü Windows Gezgininde açar |
