import os
import uuid
import tempfile
import urllib.parse
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

app = FastAPI(title="YouTube MP3 Cloud Engine")

# CORS izinleri (GitHub Pages üzerinden çağrılabilmesi için şart)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = os.path.join(tempfile.gettempdir(), "yt_mp3_cloud")
os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_file(filepath: str):
    """İndirme bittikten sonra geçici MP3 dosyasını diskten temizler"""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"[TEMİZLİK] Geçici dosya silindi: {filepath}")
    except Exception as e:
        print(f"[TEMİZLİK HATA] {e}")

@app.get("/")
def home():
    return {
        "status": "online",
        "service": "YouTube MP3 Cloud Engine",
        "docs": "Pass url to /api/download?url=..."
    }

@app.get("/api/info")
def get_info(url: str = Query(...)):
    """Şarkı başlığı ve kapak görselini döner"""
    ydl_opts = {"quiet": True, "noplaylist": True, "no_warnings": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "status": "success",
                "title": info.get("title"),
                "artist": info.get("uploader"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration")
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/download")
def download_mp3(url: str = Query(...), background_tasks: BackgroundTasks = None):
    """YouTube linkini doğrudan 320 kbps MP3 olarak tarayıcıya dosya olarak fırlatır"""
    task_id = str(uuid.uuid4())[:8]
    output_template = os.path.join(TEMP_DIR, f"{task_id}_%(title)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "320",
        }]
    }

    # Yerel ortamda bin/ffmpeg.exe varsa kullan
    base_dir = os.path.dirname(os.path.abspath(__file__))
    local_ffmpeg = os.path.join(base_dir, "bin", "ffmpeg.exe")
    if os.path.exists(local_ffmpeg):
        ydl_opts["ffmpeg_location"] = os.path.join(base_dir, "bin")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "music")
            safe_title = "".join(c for c in title if c not in '<>:"/\\|?*').strip() or "song"

            # İndirilen MP3 dosyasını bul
            expected_prefix = f"{task_id}_"
            target_file = None
            for f in os.listdir(TEMP_DIR):
                if f.startswith(expected_prefix) and f.endswith(".mp3"):
                    target_file = os.path.join(TEMP_DIR, f)
                    break

            if not target_file or not os.path.exists(target_file):
                raise HTTPException(status_code=500, detail="MP3 dönüştürme tamamlanamadı.")

            # İndirme bitince arka planda dosyayı diskten sil
            if background_tasks:
                background_tasks.add_task(cleanup_file, target_file)

            encoded_filename = urllib.parse.quote(f"{safe_title}.mp3")
            return FileResponse(
                path=target_file,
                media_type="audio/mpeg",
                filename=f"{safe_title}.mp3",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
                }
            )

    except Exception as e:
        print(f"[İNDİRME HATA] {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    print(f"🚀 MP3 Cloud Engine başlatılıyor... Port: {port}")
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
