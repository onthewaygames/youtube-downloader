// ==========================================================================
// YOUTUBE MP3 STUDIO — FRONTEND CONTROLLER v2.2
// 100% Client-Side Cloud Mode & Localhost Dual Engine
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Varsayılan 7/24 Canlı Render Bulut Motoru
    const DEFAULT_CLOUD_API_URL = 'https://youtube-mp3-engine.onrender.com';

    // Ortam Tespiti
    const isLocalMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // DOM Elemanları
    const envText = document.getElementById('envText');
    const btnShareLink = document.getElementById('btnShareLink');
    const linksList = document.getElementById('linksList');
    const btnAddRow = document.getElementById('btnAddRow');
    const btnAddMoreRows = document.getElementById('btnAddMoreRows');
    const btnDownloadAll = document.getElementById('btnDownloadAll');
    const btnBulkPaste = document.getElementById('btnBulkPaste');
    const btnClearCompleted = document.getElementById('btnClearCompleted');
    const btnResetAll = document.getElementById('btnResetAll');

    // Playlist Elemanları
    const globalPlaylistSelect = document.getElementById('globalPlaylistSelect');
    const newPlaylistInput = document.getElementById('newPlaylistInput');
    const btnCreatePlaylist = document.getElementById('btnCreatePlaylist');
    const playlistsList = document.getElementById('playlistsList');
    const playlistCountBadge = document.getElementById('playlistCountBadge');

    // İndirme Geçmişi
    const folderFilesList = document.getElementById('folderFilesList');
    const downloadedCountBadge = document.getElementById('downloadedCountBadge');
    const currentFolderTitle = document.getElementById('currentFolderTitle');

    // Modal
    const bulkModal = document.getElementById('bulkModal');
    const btnCloseBulkModal = document.getElementById('btnCloseBulkModal');
    const btnCancelBulk = document.getElementById('btnCancelBulk');
    const btnApplyBulk = document.getElementById('btnApplyBulk');
    const bulkTextarea = document.getElementById('bulkTextarea');

    // Durum Değişkenleri
    let playlists = JSON.parse(localStorage.getItem('yt_mp3_playlists') || '["Genel Müzikler"]');
    let activePlaylist = playlists[0];
    let downloadHistory = JSON.parse(localStorage.getItem('yt_mp3_history') || '[]');

    // Ortam Başlığı
    if (envText) {
        envText.textContent = isLocalMode ? "Yerel Motor (Port 5050)" : "🟢 Bulut Motoru Aktif (7/24 Canlı)";
    }

    // ==========================================================================
    // 1. YOUTUBE YARDIMCI FONKSİYONLARI
    // ==========================================================================
    function extractVideoId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    async function fetchVideoDetails(videoId) {
        try {
            const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            if (res.ok) {
                const data = await res.json();
                return {
                    title: data.title || "YouTube Videosu",
                    author: data.author_name || "",
                    thumb: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                };
            }
        } catch (e) {
            console.warn("noembed hatası:", e);
        }
        return {
            title: "YouTube Videosu",
            author: "",
            thumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
    }

    // ==========================================================================
    // 2. SATIR BAĞLAMA VE YÖNETİMİ
    // ==========================================================================
    function bindRowEvents(row) {
        const input = row.querySelector('.row-input');
        const pasteBtn = row.querySelector('.btn-paste-row');
        const downloadBtn = row.querySelector('.btn-row-download');
        const deleteBtn = row.querySelector('.btn-row-delete');

        if (!input) return;

        // Pano Yapıştırma
        if (pasteBtn) {
            pasteBtn.onclick = async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim()) {
                        input.value = text.trim();
                        handleUrlChange(row, input.value.trim());
                    }
                } catch (err) {
                    console.error("Pano hatası:", err);
                }
            };
        }

        // Input Değişimi
        let debounceTimer;
        input.oninput = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                handleUrlChange(row, input.value.trim());
            }, 300);
        };

        // İndir Butonu
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                downloadSingleRow(row);
            };
        }

        // Sil Butonu
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (linksList.children.length > 1) {
                    row.remove();
                    renumberRows();
                } else {
                    input.value = '';
                    handleUrlChange(row, '');
                }
            };
        }
    }

    function createRow(initialUrl = '') {
        const indexNumber = String(linksList.children.length + 1).padStart(2, '0');
        const row = document.createElement('div');
        row.className = 'link-row';
        row.dataset.status = 'idle';

        row.innerHTML = `
            <div class="row-index">#${indexNumber}</div>
            <div class="row-url-wrapper">
                <input type="text" class="form-input row-input" placeholder="YouTube linki yapıştırın..." value="${initialUrl}">
                <button class="btn-paste-row" title="Panodan Yapıştır">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </button>
            </div>
            <div class="row-preview"><div class="preview-card-empty">Link Bekleniyor</div></div>
            <div class="row-status-wrapper"><div class="status-badge status-idle"><span class="status-text">Boş</span></div></div>
            <div class="row-actions">
                <button class="btn-row-action btn-row-download" title="MP3 İndir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                <button class="btn-row-action delete btn-row-delete" title="Satırı Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
        `;

        bindRowEvents(row);
        linksList.appendChild(row);

        if (initialUrl) {
            handleUrlChange(row, initialUrl);
        }

        return row;
    }

    async function handleUrlChange(row, url) {
        const previewEl = row.querySelector('.row-preview');
        const videoId = extractVideoId(url);

        if (!videoId) {
            if (previewEl) previewEl.innerHTML = `<div class="preview-card-empty">Link Bekleniyor</div>`;
            updateRowStatus(row, 'idle', url ? 'Geçersiz Link' : 'Boş');
            row.dataset.title = '';
            row.dataset.videoId = '';
            return;
        }

        row.dataset.videoId = videoId;
        updateRowStatus(row, 'loading', 'Şarkı aranıyor...');

        const details = await fetchVideoDetails(videoId);
        row.dataset.title = details.title;

        if (previewEl) {
            previewEl.innerHTML = `
                <div class="song-preview-card">
                    <img src="${details.thumb}" alt="Kapak" class="song-thumb">
                    <div class="song-info">
                        <span class="song-title" title="${details.title}">${details.title}</span>
                        <span class="song-artist">${details.author}</span>
                    </div>
                </div>
            `;
        }

        updateRowStatus(row, 'ready', '🎵 MP3 Hazır (320k)');
    }

    function renumberRows() {
        const rows = linksList.querySelectorAll('.link-row');
        rows.forEach((r, idx) => {
            const indexEl = r.querySelector('.row-index');
            if (indexEl) {
                indexEl.textContent = `#${String(idx + 1).padStart(2, '0')}`;
            }
        });
    }

    function updateRowStatus(row, state, text) {
        row.dataset.status = state;
        const badge = row.querySelector('.status-badge');
        const statusText = row.querySelector('.status-text');

        if (badge) badge.className = `status-badge status-${state}`;
        if (statusText) statusText.textContent = text;
    }

    // Mevcut sayfadaki satırları bağla
    function initExistingRows() {
        const rows = linksList.querySelectorAll('.link-row');
        if (rows.length === 0) {
            for (let i = 0; i < 6; i++) {
                createRow();
            }
        } else {
            rows.forEach(r => bindRowEvents(r));
        }
    }

    // ==========================================================================
    // 3. İNDİRME MOTORU (YENİ SEKME AÇMAZ — DOĞRUDAN CİHAZA İNDİRİR)
    // ==========================================================================
    async function downloadSingleRow(row) {
        const input = row.querySelector('.row-input');
        const url = input ? input.value.trim() : '';
        const videoId = row.dataset.videoId || extractVideoId(url);

        if (!videoId) {
            updateRowStatus(row, 'error', 'Geçerli Link Girin!');
            return;
        }

        const title = row.dataset.title || "YouTube MP3";
        updateRowStatus(row, 'downloading', 'Bulutta Hazırlanıyor...');

        // Aktif backend URL'sini belirle (Varsayılan Render Canlı Motoru)
        let activeBackend = localStorage.getItem('yt_cloud_api_url') || DEFAULT_CLOUD_API_URL;
        if (isLocalMode) {
            activeBackend = 'http://localhost:5050';
        }

        if (activeBackend) {
            const cleanBackend = activeBackend.replace(/\/$/, '');
            const downloadEndpoint = `${cleanBackend}/api/download?url=${encodeURIComponent(url)}`;
            const safeName = (title || 'YouTube_Audio').replace(/[<>:"/\\|?*]/g, '_');

            try {
                updateRowStatus(row, 'downloading', 'Dönüştürülüyor (320k)...');
                
                const res = await fetch(downloadEndpoint);
                if (!res.ok) {
                    let errDetail = `HTTP ${res.status}`;
                    try {
                        const errJson = await res.json();
                        if (errJson && errJson.detail) {
                            errDetail = errJson.detail;
                        }
                    } catch (_) {}
                    console.error("Bulut motoru hatası:", errDetail);
                    updateRowStatus(row, 'error', 'İndirme Hatası');
                    alert(`İndirme Hatası:\n${errDetail.substring(0, 120)}`);
                    return;
                }
                
                updateRowStatus(row, 'downloading', 'MP3 İndiriliyor...');
                const blob = await res.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const tempLink = document.createElement('a');
                tempLink.style.display = 'none';
                tempLink.href = blobUrl;
                tempLink.download = `${safeName}.mp3`;
                document.body.appendChild(tempLink);
                tempLink.click();
                
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                    tempLink.remove();
                }, 3000);

                updateRowStatus(row, 'completed', 'MP3 İndirildi ✓');
                addDownloadHistory(title, globalPlaylistSelect.value);
                return;
            } catch (err) {
                console.error("Bağlantı hatası:", err);
                updateRowStatus(row, 'error', 'Bağlantı Hatası');
                alert('Bulut motoruna bağlanılamadı. Lütfen motor durumunu kontrol edin.');
                return;
            }
        }

        // Eğer henüz bir bulut motoru bağlanmadıysa kullanıcıya ayar penceresini aç
        updateRowStatus(row, 'loading', 'Motor Bekleniyor');
        openSettingsModal();
    }

    function pollLocalProgress(row, taskId, title) {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/progress?id=${taskId}`);
                const data = await res.json();
                if (data.status === 'success' && data.task) {
                    const task = data.task;
                    if (task.status === 'downloading') {
                        updateRowStatus(row, 'downloading', `%${task.percent}`);
                    } else if (task.status === 'completed') {
                        clearInterval(interval);
                        updateRowStatus(row, 'completed', 'Tamamlandı ✓');
                        addDownloadHistory(title, globalPlaylistSelect.value);
                    } else if (task.status === 'error') {
                        clearInterval(interval);
                        updateRowStatus(row, 'error', 'Hata!');
                    }
                }
            } catch (e) {
                clearInterval(interval);
                updateRowStatus(row, 'error', 'Koptu');
            }
        }, 1000);
    }

    function downloadAllRows() {
        const rows = linksList.querySelectorAll('.link-row');
        let delay = 0;
        let count = 0;

        rows.forEach(row => {
            const input = row.querySelector('.row-input');
            const url = input ? input.value.trim() : '';
            const videoId = extractVideoId(url);

            if (videoId) {
                count++;
                setTimeout(() => {
                    downloadSingleRow(row);
                }, delay);
                delay += 1000;
            }
        });

        if (count === 0) {
            alert('Lütfen önce en az bir YouTube linki yapıştırın.');
        }
    }

    // ==========================================================================
    // 4. PLAYLIST & GEÇMİŞ YÖNETİMİ
    // ==========================================================================
    function savePlaylists() {
        localStorage.setItem('yt_mp3_playlists', JSON.stringify(playlists));
        renderPlaylistsUI();
    }

    function renderPlaylistsUI() {
        if (!globalPlaylistSelect || !playlistsList) return;

        globalPlaylistSelect.innerHTML = '';
        playlistsList.innerHTML = '';
        if (playlistCountBadge) playlistCountBadge.textContent = `${playlists.length} Liste`;

        playlists.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl;
            opt.textContent = pl;
            if (pl === activePlaylist) opt.selected = true;
            globalPlaylistSelect.appendChild(opt);

            const item = document.createElement('div');
            item.className = `playlist-item ${activePlaylist === pl ? 'active' : ''}`;
            const count = downloadHistory.filter(h => h.playlist === pl).length;

            item.innerHTML = `
                <div class="playlist-meta">
                    <span class="playlist-title">${pl}</span>
                    <span class="playlist-stats">${count} parça</span>
                </div>
                ${pl !== 'Genel Müzikler' ? `
                    <button class="btn-icon btn-delete-pl" title="Listeyi Sil">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                ` : ''}
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-pl')) return;
                activePlaylist = pl;
                globalPlaylistSelect.value = pl;
                renderPlaylistsUI();
            });

            const delBtn = item.querySelector('.btn-delete-pl');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`"${pl}" çalma listesini silmek istiyor musunuz?`)) {
                        playlists = playlists.filter(p => p !== pl);
                        if (activePlaylist === pl) activePlaylist = playlists[0];
                        savePlaylists();
                    }
                });
            }

            playlistsList.appendChild(item);
        });

        renderHistoryUI();
    }

    function addDownloadHistory(title, playlistName) {
        const item = {
            id: Date.now(),
            title: title,
            playlist: playlistName || activePlaylist,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        downloadHistory.unshift(item);
        if (downloadHistory.length > 50) downloadHistory.pop();
        localStorage.setItem('yt_mp3_history', JSON.stringify(downloadHistory));
        renderHistoryUI();
    }

    function renderHistoryUI() {
        if (!folderFilesList) return;

        const currentList = downloadHistory.filter(h => h.playlist === activePlaylist);
        if (currentFolderTitle) currentFolderTitle.textContent = `🎵 ${activePlaylist}`;
        if (downloadedCountBadge) downloadedCountBadge.textContent = `${currentList.length} MP3`;
        folderFilesList.innerHTML = '';

        if (currentList.length === 0) {
            folderFilesList.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">
                    Bu listede henüz indirilmiş MP3 yok.
                </div>
            `;
            return;
        }

        currentList.forEach(item => {
            const el = document.createElement('div');
            el.className = 'file-item';
            el.innerHTML = `
                <div class="file-info" title="${item.title}">
                    <span class="file-name">${item.title}</span>
                    <span class="file-details">MP3 · 320 kbps · ${item.time}</span>
                </div>
            `;
            folderFilesList.appendChild(el);
        });
    }

    // ==========================================================================
    // 5. ETKİLEŞİMLER & MODAL
    // ==========================================================================
    if (btnCreatePlaylist) {
        btnCreatePlaylist.addEventListener('click', () => {
            const name = newPlaylistInput.value.trim();
            if (!name) return;
            if (playlists.includes(name)) {
                alert('Bu isimde bir liste zaten var.');
                return;
            }
            playlists.push(name);
            activePlaylist = name;
            newPlaylistInput.value = '';
            savePlaylists();
        });
    }

    if (globalPlaylistSelect) {
        globalPlaylistSelect.addEventListener('change', () => {
            activePlaylist = globalPlaylistSelect.value;
            renderPlaylistsUI();
        });
    }

    // Toplu Yapıştır
    if (btnBulkPaste) {
        btnBulkPaste.addEventListener('click', () => {
            bulkTextarea.value = '';
            bulkModal.classList.add('open');
            bulkTextarea.focus();
        });
    }

    function closeBulkModal() {
        if (bulkModal) bulkModal.classList.remove('open');
    }

    if (btnCloseBulkModal) btnCloseBulkModal.addEventListener('click', closeBulkModal);
    if (btnCancelBulk) btnCancelBulk.addEventListener('click', closeBulkModal);

    if (btnApplyBulk) {
        btnApplyBulk.addEventListener('click', () => {
            const text = bulkTextarea.value.trim();
            if (!text) {
                closeBulkModal();
                return;
            }

            const lines = text.split('\n')
                .map(l => l.trim())
                .filter(l => extractVideoId(l));

            if (lines.length === 0) {
                alert('Yapıştırılan metinde geçerli YouTube linki bulunamadı.');
                return;
            }

            const existingRows = linksList.querySelectorAll('.link-row');
            let lineIdx = 0;

            existingRows.forEach(row => {
                const input = row.querySelector('.row-input');
                if (input && !input.value.trim() && lineIdx < lines.length) {
                    input.value = lines[lineIdx];
                    handleUrlChange(row, lines[lineIdx]);
                    lineIdx++;
                }
            });

            while (lineIdx < lines.length) {
                createRow(lines[lineIdx]);
                lineIdx++;
            }

            renumberRows();
            closeBulkModal();
        });
    }

    // Link Paylaş
    if (btnShareLink) {
        btnShareLink.addEventListener('click', async () => {
            const shareUrl = window.location.href;
            try {
                await navigator.clipboard.writeText(shareUrl);
                alert('✓ Site linki kopyalandı! Arkadaşına gönderebilirsin:\n' + shareUrl);
            } catch (e) {
                prompt('Site linki:', shareUrl);
            }
        });
    }

    if (btnAddRow) btnAddRow.addEventListener('click', () => createRow());
    if (btnAddMoreRows) btnAddMoreRows.addEventListener('click', () => {
        for (let i = 0; i < 3; i++) createRow();
    });
    if (btnDownloadAll) btnDownloadAll.addEventListener('click', downloadAllRows);
    if (btnClearCompleted) {
        btnClearCompleted.addEventListener('click', () => {
            const rows = linksList.querySelectorAll('.link-row');
            rows.forEach(r => {
                if (r.dataset.status === 'completed') r.remove();
            });
            renumberRows();
        });
    }
    if (btnResetAll) {
        btnResetAll.addEventListener('click', () => {
            if (confirm('Tüm link listesini sıfırlamak istiyor musunuz?')) {
                linksList.innerHTML = '';
                for (let i = 0; i < 6; i++) {
                    createRow();
                }
            }
        });
    }

    // ==========================================================================
    // 6. BULUT MOTORU AYARLARI MODALI
    // ==========================================================================
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
    const btnCancelSettings = document.getElementById('btnCancelSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const cloudApiInput = document.getElementById('cloudApiInput');
    const btnTestCloudApi = document.getElementById('btnTestCloudApi');
    const cloudApiStatus = document.getElementById('cloudApiStatus');

    function openSettingsModal() {
        if (!settingsModal) return;
        if (cloudApiInput) {
            cloudApiInput.value = localStorage.getItem('yt_cloud_api_url') || DEFAULT_CLOUD_API_URL;
        }
        if (cloudApiStatus) {
            cloudApiStatus.textContent = '';
        }
        settingsModal.classList.add('open');
    }

    function closeSettingsModal() {
        if (!settingsModal) return;
        settingsModal.classList.remove('open');
    }

    if (btnSettings) btnSettings.onclick = openSettingsModal;
    if (btnCloseSettingsModal) btnCloseSettingsModal.onclick = closeSettingsModal;
    if (btnCancelSettings) btnCancelSettings.onclick = closeSettingsModal;

    if (btnTestCloudApi) {
        btnTestCloudApi.onclick = async () => {
            const val = cloudApiInput.value.trim().replace(/\/$/, '');
            if (!val) {
                cloudApiStatus.style.color = 'var(--accent-red)';
                cloudApiStatus.textContent = 'Lütfen bir URL girin.';
                return;
            }
            cloudApiStatus.style.color = 'var(--accent-amber)';
            cloudApiStatus.textContent = 'Bağlantı test ediliyor...';
            try {
                const res = await fetch(`${val}/`);
                if (res.ok) {
                    cloudApiStatus.style.color = 'var(--accent-green)';
                    cloudApiStatus.textContent = '✓ Motor Aktif ve Yanıt Veriyor!';
                } else {
                    cloudApiStatus.style.color = 'var(--accent-red)';
                    cloudApiStatus.textContent = `Hata: HTTP ${res.status}`;
                }
            } catch (e) {
                cloudApiStatus.style.color = 'var(--accent-red)';
                cloudApiStatus.textContent = 'Bağlantı kurulamadı. URL hatalı veya sunucu henüz açılmamış.';
            }
        };
    }

    if (btnSaveSettings) {
        btnSaveSettings.onclick = () => {
            const val = cloudApiInput.value.trim().replace(/\/$/, '');
            if (val) {
                localStorage.setItem('yt_cloud_api_url', val);
                if (envText) envText.textContent = "🟢 Bulut Motoru Aktif (7/24 Canlı)";
                alert('✓ Bulut motoru adresi kaydedildi!');
            } else {
                localStorage.removeItem('yt_cloud_api_url');
                if (envText) envText.textContent = "🟢 Bulut Motoru Aktif (7/24 Canlı)";
            }
            closeSettingsModal();
        };
    }

    // Başlatma
    if (envText) {
        envText.textContent = isLocalMode ? "Yerel Motor (Port 5050)" : "🟢 Bulut Motoru Aktif (7/24 Canlı)";
    }

    initExistingRows();
    renderPlaylistsUI();
});
