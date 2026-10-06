import http.server
import socketserver
import json
import urllib.parse
import os
import sys
import threading
import uuid
import time
import shutil

# Windows terminal UTF-8 desteği
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

try:
    import yt_dlp
except ImportError:
    print("[HATA] yt-dlp kütüphanesi eksik. Lütfen 'pip install yt-dlp' çalıştırın.")
    sys.exit(1)

PORT = 5050
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(PROJECT_DIR, "downloads")
BIN_DIR = os.path.join(PROJECT_DIR, "bin")

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(BIN_DIR, exist_ok=True)

# İndirme görevleri sözlüğü
DOWNLOAD_TASKS = {}
TASKS_LOCK = threading.Lock()

def sanitize_folder_name(name):
    # Klasör ismi temizleme
    invalid_chars = '<>:"/\\|?*'
    clean = "".join(c for c in name if c not in invalid_chars).strip()
    return clean if clean else "Genel"

def get_playlists_info():
    playlists = []
    
    # 1. Ana Downloads dizinindeki kök dosyalar
    root_files = []
    total_root_size = 0
    if os.path.exists(DOWNLOADS_DIR):
        for item in os.listdir(DOWNLOADS_DIR):
            item_path = os.path.join(DOWNLOADS_DIR, item)
            if os.path.isfile(item_path):
                size = os.path.getsize(item_path)
                mtime = os.path.getmtime(item_path)
                root_files.append({
                    "name": item,
                    "size_mb": round(size / (1024 * 1024), 2),
                    "modified": time.strftime('%Y-%m-%d %H:%M', time.localtime(mtime)),
                    "path": item_path
                })
                total_root_size += size

    playlists.append({
        "name": "Genel İndirilenler",
        "folder": "",
        "is_root": True,
        "file_count": len(root_files),
        "total_size_mb": round(total_root_size / (1024 * 1024), 2),
        "files": root_files
    })

    # 2. Alt klasörler (Playlistler)
    if os.path.exists(DOWNLOADS_DIR):
        for item in os.listdir(DOWNLOADS_DIR):
            item_path = os.path.join(DOWNLOADS_DIR, item)
            if os.path.isdir(item_path):
                folder_files = []
                folder_size = 0
                for sub in os.listdir(item_path):
                    sub_path = os.path.join(item_path, sub)
                    if os.path.isfile(sub_path):
                        s = os.path.getsize(sub_path)
                        mt = os.path.getmtime(sub_path)
                        folder_files.append({
                            "name": sub,
                            "size_mb": round(s / (1024 * 1024), 2),
                            "modified": time.strftime('%Y-%m-%d %H:%M', time.localtime(mt)),
                            "path": sub_path
                        })
                        folder_size += s
                playlists.append({
                    "name": item,
                    "folder": item,
                    "is_root": False,
                    "file_count": len(folder_files),
                    "total_size_mb": round(folder_size / (1024 * 1024), 2),
                    "files": folder_files
                })
                
    return playlists

def download_worker(task_id, url, playlist_name, quality_format):
    with TASKS_LOCK:
        DOWNLOAD_TASKS[task_id]["status"] = "starting"
        DOWNLOAD_TASKS[task_id]["percent"] = 0

    # Hedef dizini belirle
    if playlist_name and playlist_name.strip() and playlist_name != "Genel İndirilenler":
        clean_playlist = sanitize_folder_name(playlist_name)
        target_dir = os.path.join(DOWNLOADS_DIR, clean_playlist)
    else:
        target_dir = DOWNLOADS_DIR

    os.makedirs(target_dir, exist_ok=True)

    def progress_hook(d):
        with TASKS_LOCK:
            task = DOWNLOAD_TASKS.get(task_id)
            if not task:
                return
            
            if d['status'] == 'downloading':
                task['status'] = 'downloading'
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes') or 0
                if total > 0:
                    task['percent'] = round((downloaded / total) * 100, 1)
                
                speed = d.get('speed')
                if speed:
                    task['speed'] = f"{round(speed / (1024 * 1024), 2)} MB/s"
                eta = d.get('eta')
                if eta:
                    task['eta'] = f"{eta} sn"
            elif d['status'] == 'finished':
                task['status'] = 'processing'
                task['percent'] = 100

    # Ffmpeg kontrolü
    ffmpeg_exe = os.path.join(BIN_DIR, "ffmpeg.exe")
    has_ffmpeg = os.path.exists(ffmpeg_exe)

    # Format ayarları
    ydl_opts = {
        'outtmpl': os.path.join(target_dir, '%(title)s.%(ext)s'),
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [progress_hook]
    }

    if has_ffmpeg:
        ydl_opts['ffmpeg_location'] = BIN_DIR

    if quality_format == 'mp3':
        ydl_opts['format'] = 'bestaudio/best'
        if has_ffmpeg:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            }]
    elif quality_format == '1080p':
        ydl_opts['format'] = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
        if has_ffmpeg:
            ydl_opts['merge_output_format'] = 'mp4'
    elif quality_format == '720p':
        ydl_opts['format'] = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best'
        if has_ffmpeg:
            ydl_opts['merge_output_format'] = 'mp4'
    else: # best / mp4
        ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best'
        if has_ffmpeg:
            ydl_opts['merge_output_format'] = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Video başlığını önceden yakala
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "Video")
            ext = "mp3" if quality_format == 'mp3' and has_ffmpeg else (info.get("ext") or "mp4")
            
            with TASKS_LOCK:
                DOWNLOAD_TASKS[task_id]["title"] = title
                DOWNLOAD_TASKS[task_id]["status"] = "completed"
                DOWNLOAD_TASKS[task_id]["percent"] = 100
                DOWNLOAD_TASKS[task_id]["filename"] = f"{title}.{ext}"
                DOWNLOAD_TASKS[task_id]["folder"] = target_dir
                print(f"[İNDİRME TAMAMLANDI] {title} -> {target_dir}")
                
    except Exception as e:
        print(f"[HATA] İndirme başarısız ({url}): {e}")
        with TASKS_LOCK:
            DOWNLOAD_TASKS[task_id]["status"] = "error"
            DOWNLOAD_TASKS[task_id]["error"] = str(e)


class DownloaderHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.end_headers()

    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # 1. API: Playlists bilgisi
        if parsed.path == "/api/playlists":
            playlists = get_playlists_info()
            self.send_json({"status": "success", "playlists": playlists})
            return

        # 2. API: İlerleme durumu
        if parsed.path == "/api/progress":
            query = urllib.parse.parse_qs(parsed.query)
            task_id = query.get("id", [""])[0]
            with TASKS_LOCK:
                task = DOWNLOAD_TASKS.get(task_id)
            if task:
                self.send_json({"status": "success", "task": task})
            else:
                self.send_json({"status": "error", "message": "Görev bulunamadı"}, 404)
            return

        # 3. Normal dosya sunumu (index.html, style.css, app.js vs.)
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        # 1. API: İndirme Başlat
        if parsed.path == "/api/download":
            url = body.get("url", "").strip()
            playlist = body.get("playlist", "").strip()
            fmt = body.get("format", "mp4")

            if not url:
                self.send_json({"status": "error", "message": "URL parametresi eksik"}, 400)
                return

            task_id = str(uuid.uuid4())
            with TASKS_LOCK:
                DOWNLOAD_TASKS[task_id] = {
                    "id": task_id,
                    "url": url,
                    "playlist": playlist,
                    "format": fmt,
                    "status": "queued",
                    "percent": 0,
                    "speed": "-",
                    "eta": "-",
                    "title": "Bilgi alınıyor...",
                    "error": None
                }

            # Arka planda indirme thread'i başlat
            thread = threading.Thread(
                target=download_worker,
                args=(task_id, url, playlist, fmt),
                daemon=True
            )
            thread.start()

            self.send_json({"status": "started", "task_id": task_id})
            return

        # 2. API: Yeni Playlist Oluştur
        if parsed.path == "/api/playlists":
            name = body.get("name", "").strip()
            if not name:
                self.send_json({"status": "error", "message": "Playlist adı boş olamaz"}, 400)
                return

            clean_name = sanitize_folder_name(name)
            folder_path = os.path.join(DOWNLOADS_DIR, clean_name)
            os.makedirs(folder_path, exist_ok=True)
            self.send_json({"status": "success", "created": clean_name})
            return

        # 3. API: Listeden Listeyi Çek / Klasöre Taşı (Organize)
        if parsed.path == "/api/organize":
            target_playlist = body.get("target_playlist", "").strip()
            selected_files = body.get("files", []) # Opsiyonel: belirli dosyalar

            if not target_playlist:
                self.send_json({"status": "error", "message": "Hedef playlist seçilmedi"}, 400)
                return

            clean_target = sanitize_folder_name(target_playlist)
            target_path = os.path.join(DOWNLOADS_DIR, clean_target)
            os.makedirs(target_path, exist_ok=True)

            moved_count = 0
            # Eğer belirli dosya listesi verilmediyse, Downloads kökündeki tüm dosyaları taşı
            if not selected_files:
                for item in os.listdir(DOWNLOADS_DIR):
                    src = os.path.join(DOWNLOADS_DIR, item)
                    if os.path.isfile(src):
                        dst = os.path.join(target_path, item)
                        # Aynı isimde dosya varsa üzerine yazma/yeniden adlandır
                        if os.path.exists(dst):
                            base, ext = os.path.splitext(item)
                            dst = os.path.join(target_path, f"{base}_{int(time.time())}{ext}")
                        shutil.move(src, dst)
                        moved_count += 1
            else:
                for filename in selected_files:
                    src = os.path.join(DOWNLOADS_DIR, filename)
                    if os.path.exists(src) and os.path.isfile(src):
                        dst = os.path.join(target_path, filename)
                        if os.path.exists(dst):
                            base, ext = os.path.splitext(filename)
                            dst = os.path.join(target_path, f"{base}_{int(time.time())}{ext}")
                        shutil.move(src, dst)
                        moved_count += 1

            self.send_json({
                "status": "success",
                "target_playlist": clean_target,
                "moved_count": moved_count
            })
            return

        # 4. API: Windows Gezgininde Klasörü Aç
        if parsed.path == "/api/open-folder":
            playlist = body.get("playlist", "").strip()
            if playlist and playlist != "Genel İndirilenler":
                clean_name = sanitize_folder_name(playlist)
                folder_path = os.path.join(DOWNLOADS_DIR, clean_name)
            else:
                folder_path = DOWNLOADS_DIR

            os.makedirs(folder_path, exist_ok=True)
            try:
                os.startfile(folder_path)
                self.send_json({"status": "success", "opened": folder_path})
            except Exception as e:
                self.send_json({"status": "error", "message": str(e)}, 500)
            return

        self.send_json({"status": "error", "message": "Endpoint bulunamadı"}, 404)


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    print(f"=====================================================")
    print(f"🎬 YOUTUBE DOWNLOADER & PLAYLIST STUDIO")
    print(f"=====================================================")
    print(f"📡 Web Arayüzü: http://localhost:{PORT}")
    print(f"📁 İndirme Klasörü: {DOWNLOADS_DIR}")
    print(f"⚙️ FFmpeg Durumu: {'AKTİF (bin/ffmpeg.exe)' if os.path.exists(os.path.join(BIN_DIR, 'ffmpeg.exe')) else 'YOK'}")
    print(f"=====================================================")
    
    with ThreadedTCPServer(("", PORT), DownloaderHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[BİLGİ] Sunucu kapatılıyor...")
            sys.exit(0)
