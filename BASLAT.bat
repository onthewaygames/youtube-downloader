@echo off
chcp 65001 >nul
title YouTube Downloader & Playlist Studio
echo ========================================================
echo   🎬 YOUTUBE DOWNLOADER & PLAYLIST STUDIO BASLATILIYOR
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Tarayici aciliyor...
start http://localhost:5050

echo [2/2] Python web sunucusu calistiriliyor (Port: 5050)...
python server.py

pause
