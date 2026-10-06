// ==========================================================================
// YOUTUBE STUDIO DOWNLOADER & PLAYLIST STUDIO
// Frontend Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // DOM Öğeleri
    const linksList = document.getElementById('linksList');
    const btnAddRow = document.getElementById('btnAddRow');
    const btnAddMoreRows = document.getElementById('btnAddMoreRows');
    const btnDownloadAll = document.getElementById('btnDownloadAll');
    const btnBulkPaste = document.getElementById('btnBulkPaste');
    const btnClearCompleted = document.getElementById('btnClearCompleted');
    const btnResetAll = document.getElementById('btnResetAll');
    
    // Playlist Elemanları
    const globalPlaylistSelect = document.getElementById('globalPlaylistSelect');
    const globalFormatSelect = document.getElementById('globalFormatSelect');
    const newPlaylistInput = document.getElementById('newPlaylistInput');
    const btnCreatePlaylist = document.getElementById('btnCreatePlaylist');
    const playlistsList = document.getElementById('playlistsList');
    const playlistCountBadge = document.getElementById('playlistCountBadge');
    const btnRefreshPlaylists = document.getElementById('btnRefreshPlaylists');
    const btnOpenRootFolder = document.getElementById('btnOpenRootFolder');

    // Organize Elemanları
    const organizeTargetSelect = document.getElementById('organizeTargetSelect');
    const btnOrganizeFiles = document.getElementById('btnOrganizeFiles');
    const organizeResult = document.getElementById('organizeResult');

    // Dosya Kütüphanesi
    const folderFilesList = document.getElementById('folderFilesList');
    const currentFolderTitle = document.getElementById('currentFolderTitle');

    // Bulk Modal Elemanları
    const bulkModal = document.getElementById('bulkModal');
    const btnCloseBulkModal = document.getElementById('btnCloseBulkModal');
    const btnCancelBulk = document.getElementById('btnCancelBulk');
    const btnApplyBulk = document.getElementById('btnApplyBulk');
    const bulkTextarea = document.getElementById('bulkTextarea');

    // Durum Değişkenleri
    let rowCounter = 0;
    let playlistsData = [];
    let activeSelectedPlaylist = ""; // Boş ise kök (Genel)

    // ==========================================================================
    // 1. SATIR YÖNETİMİ (DEFAULT 6 SIRALI DİNAMİK LİSTE)
    // ==========================================================================
    function createRow(initialUrl = '') {
        rowCounter++;
        const rowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const indexNumber = String(linksList.children.length + 1).padStart(2, '0');

        const row = document.createElement('div');
        row.className = 'link-row';
        row.id = rowId;
        row.dataset.status = 'idle';

        row.innerHTML = `
            <div class="row-index">#${indexNumber}</div>
            <div class="row-url-wrapper">
                <input type="text" class="form-input row-input" placeholder="YouTube linki yapıştırın (https://www.youtube.com/watch?v=...)" value="${initialUrl}">
                <button class="btn-paste-row" title="Panodan Yapıştır">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </button>
            </div>
            <div class="row-format">
                <select class="form-select row-format-select">
                    <option value="inherit">Global Format</option>
                    <option value="mp4">MP4 (En Yüksek)</option>
                    <option value="1080p">MP4 (1080p)</option>
                    <option value="720p">MP4 (720p)</option>
                    <option value="mp3">MP3 (Ses)</option>
                </select>
            </div>
            <div class="row-status-wrapper">
                <div class="status-badge status-idle">
                    <span class="status-text">Boş</span>
                    <span class="speed-text"></span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: 0%;"></div>
                </div>
            </div>
            <div class="row-actions">
                <button class="btn-row-action btn-row-download" title="Bu Videoyu İndir">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
                <button class="btn-row-action delete btn-row-delete" title="Satırı Sil">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        // Satır Olayları
        const input = row.querySelector('.row-input');
        const pasteBtn = row.querySelector('.btn-paste-row');
        const downloadBtn = row.querySelector('.btn-row-download');
        const deleteBtn = row.querySelector('.btn-row-delete');

        // Panodan yapıştır butonu
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    input.value = text.trim();
                    updateRowStatus(row, 'idle', 'Hazır');
                }
            } catch (err) {
                console.error("Pano okunamadı:", err);
            }
        });

        // Giriş değiştiğinde durum güncelle
        input.addEventListener('input', () => {
            if (input.value.trim()) {
                updateRowStatus(row, 'idle', 'Hazır');
            } else {
                updateRowStatus(row, 'idle', 'Boş');
            }
        });

        // Tekil İndir butonu
        downloadBtn.addEventListener('click', () => {
            startRowDownload(row);
        });

        // Satırı Sil butonu
        deleteBtn.addEventListener('click', () => {
            if (linksList.children.length > 1) {
                row.remove();
                renumberRows();
            } else {
                input.value = '';
                updateRowStatus(row, 'idle', 'Boş');
            }
        });

        linksList.appendChild(row);
        return row;
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

    function updateRowStatus(row, state, text, percent = 0, speed = '') {
        row.dataset.status = state;
        const badge = row.querySelector('.status-badge');
        const statusText = row.querySelector('.status-text');
        const speedText = row.querySelector('.speed-text');
        const progressFill = row.querySelector('.progress-fill');

        badge.className = `status-badge status-${state}`;
        statusText.textContent = text;
        speedText.textContent = speed;
        progressFill.style.width = `${percent}%`;
    }

    // Başlangıçta tam 6 varsayılan satır oluştur
    function initializeDefaultRows(count = 6) {
        linksList.innerHTML = '';
        for (let i = 0; i < count; i++) {
            createRow();
        }
    }

    // ==========================================================================
    // 2. İNDİRME MOTORU & İLERLEME TAKİBİ
    // ==========================================================================
    async function startRowDownload(row) {
        const input = row.querySelector('.row-input');
        const url = input.value.trim();
        if (!url) {
            updateRowStatus(row, 'error', 'Link Girin!');
            return;
        }

        const formatSelect = row.querySelector('.row-format-select');
        let chosenFormat = formatSelect.value;
        if (chosenFormat === 'inherit') {
            chosenFormat = globalFormatSelect.value;
        }

        const targetPlaylist = globalPlaylistSelect.value;

        updateRowStatus(row, 'downloading', 'Başlatılıyor...', 5);

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    playlist: targetPlaylist,
                    format: chosenFormat
                })
            });

            const data = await response.json();
            if (data.status === 'started' && data.task_id) {
                pollTaskProgress(row, data.task_id);
            } else {
                updateRowStatus(row, 'error', data.message || 'Başlatılamadı');
            }
        } catch (err) {
            console.error("İndirme başlatma hatası:", err);
            updateRowStatus(row, 'error', 'Bağlantı Hatası');
        }
    }

    function pollTaskProgress(row, taskId) {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/progress?id=${taskId}`);
                const data = await res.json();

                if (data.status === 'success' && data.task) {
                    const task = data.task;

                    if (task.status === 'downloading') {
                        const speedInfo = task.speed ? `${task.speed}` : '';
                        updateRowStatus(row, 'downloading', `%${task.percent}`, task.percent, speedInfo);
                    } else if (task.status === 'processing') {
                        updateRowStatus(row, 'downloading', 'Birleştiriliyor...', 99);
                    } else if (task.status === 'completed') {
                        clearInterval(interval);
                        updateRowStatus(row, 'completed', 'Tamamlandı ✓', 100);
                        // Kitaplığı ve playlistleri güncelle
                        loadPlaylists();
                    } else if (task.status === 'error') {
                        clearInterval(interval);
                        const errMsg = (task.error && task.error.length > 25) ? task.error.substring(0, 25) + '...' : (task.error || 'Hata');
                        updateRowStatus(row, 'error', errMsg);
                    }
                }
            } catch (e) {
                console.error("Progress poll hatası:", e);
            }
        }, 800);
    }

    async function downloadAllRows() {
        const rows = linksList.querySelectorAll('.link-row');
        let delay = 0;
        rows.forEach(row => {
            const input = row.querySelector('.row-input');
            const url = input.value.trim();
            const status = row.dataset.status;

            if (url && status !== 'completed' && status !== 'downloading') {
                setTimeout(() => {
                    startRowDownload(row);
                }, delay);
                delay += 800; // Sunucuyu ve yt-dlp'yi boğmamak için ufak sıralı başlatma
            }
        });
    }

    // ==========================================================================
    // 3. PLAYLIST & DOSYA YÖNETİMİ
    // ==========================================================================
    async function loadPlaylists() {
        try {
            const res = await fetch('/api/playlists');
            const data = await res.json();

            if (data.status === 'success') {
                playlistsData = data.playlists || [];
                renderPlaylistsUI();
            }
        } catch (err) {
            console.error("Playlists yüklenemedi:", err);
        }
    }

    function renderPlaylistsUI() {
        // Dropdown'ları güncelle
        const prevGlobalVal = globalPlaylistSelect.value;
        const prevOrganizeVal = organizeTargetSelect.value;

        globalPlaylistSelect.innerHTML = '';
        organizeTargetSelect.innerHTML = '<option value="">Hedef Playlist Seçin...</option>';

        let totalPlaylistsCount = 0;

        playlistsData.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.name === 'Genel İndirilenler' ? '' : pl.name;
            opt.textContent = `${pl.name} (${pl.file_count} dosya)`;
            globalPlaylistSelect.appendChild(opt);

            if (!pl.is_root) {
                totalPlaylistsCount++;
                const orgOpt = document.createElement('option');
                orgOpt.value = pl.name;
                orgOpt.textContent = pl.name;
                organizeTargetSelect.appendChild(orgOpt);
            }
        });

        globalPlaylistSelect.value = prevGlobalVal || "";
        organizeTargetSelect.value = prevOrganizeVal || "";
        playlistCountBadge.textContent = `${totalPlaylistsCount} Liste`;

        // Playlist Listesi Kartlarını Çiz
        playlistsList.innerHTML = '';
        playlistsData.forEach(pl => {
            const item = document.createElement('div');
            item.className = `playlist-item ${activeSelectedPlaylist === pl.name ? 'active' : ''}`;
            
            item.innerHTML = `
                <div class="playlist-meta">
                    <span class="playlist-title">${pl.name}</span>
                    <span class="playlist-stats">${pl.file_count} dosya · ${pl.total_size_mb} MB</span>
                </div>
                <div class="playlist-actions">
                    <button class="btn-icon btn-open-pl-folder" title="Klasörü Aç">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
            `;

            // Tıklayınca aktif klasör yap ve dosyalarını göster
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-open-pl-folder')) return;
                activeSelectedPlaylist = pl.name;
                globalPlaylistSelect.value = pl.name === 'Genel İndirilenler' ? '' : pl.name;
                renderPlaylistsUI();
                renderFilesUI(pl);
            });

            // Klasörü Windows'ta aç
            const openBtn = item.querySelector('.btn-open-pl-folder');
            openBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await openFolder(pl.name);
            });

            playlistsList.appendChild(item);
        });

        // Seçili aktif playlist'in dosyalarını göster
        const currentActive = playlistsData.find(p => p.name === activeSelectedPlaylist) || playlistsData[0];
        if (currentActive) {
            renderFilesUI(currentActive);
        }
    }

    function renderFilesUI(playlist) {
        currentFolderTitle.textContent = `📁 ${playlist.name}`;
        folderFilesList.innerHTML = '';

        if (!playlist.files || playlist.files.length === 0) {
            folderFilesList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
                    Bu klasörde henüz dosya yok.
                </div>
            `;
            return;
        }

        playlist.files.forEach(f => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info" title="${f.name}">
                    <span class="file-name">${f.name}</span>
                    <span class="file-details">${f.size_mb} MB · ${f.modified}</span>
                </div>
                <button class="btn-icon btn-open-file-loc" title="Klasörde Göster">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
            `;

            fileItem.querySelector('.btn-open-file-loc').addEventListener('click', async () => {
                await openFolder(playlist.name);
            });

            folderFilesList.appendChild(fileItem);
        });
    }

    async function openFolder(playlistName) {
        try {
            await fetch('/api/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist: playlistName === 'Genel İndirilenler' ? '' : playlistName })
            });
        } catch (err) {
            console.error("Klasör açılamadı:", err);
        }
    }

    // ==========================================================================
    // 4. LİSTEDEN LİSTEYİ ÇEK / TAŞI (ORGANİZE ET)
    // ==========================================================================
    btnOrganizeFiles.addEventListener('click', async () => {
        const target = organizeTargetSelect.value;
        if (!target) {
            alert("Lütfen dosyaların taşınacağı bir hedef Playlist seçin.");
            return;
        }

        organizeResult.style.display = 'block';
        organizeResult.className = 'organize-feedback';
        organizeResult.textContent = 'Dosyalar taşınıyor...';

        try {
            const res = await fetch('/api/organize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_playlist: target })
            });

            const data = await res.json();
            if (data.status === 'success') {
                organizeResult.className = 'organize-feedback success';
                organizeResult.textContent = `✓ ${data.moved_count} adet dosya "${data.target_playlist}" altına taşındı.`;
                await loadPlaylists();
            } else {
                organizeResult.textContent = 'Hata: ' + (data.message || 'Taşınamadı');
            }
        } catch (err) {
            console.error("Organize hatası:", err);
            organizeResult.textContent = 'Bağlantı hatası!';
        }
    });

    // ==========================================================================
    // 5. YENİ PLAYLIST OLUŞTURMA
    // ==========================================================================
    btnCreatePlaylist.addEventListener('click', async () => {
        const name = newPlaylistInput.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });

            const data = await res.json();
            if (data.status === 'success') {
                newPlaylistInput.value = '';
                activeSelectedPlaylist = data.created;
                await loadPlaylists();
            } else {
                alert(data.message || 'Oluşturulamadı');
            }
        } catch (err) {
            console.error("Playlist oluşturma hatası:", err);
        }
    });

    // ==========================================================================
    // 6. TOPLU YAPIŞTIRMA MODALI (BULK PASTE)
    // ==========================================================================
    btnBulkPaste.addEventListener('click', () => {
        bulkTextarea.value = '';
        bulkModal.classList.add('open');
        bulkTextarea.focus();
    });

    function closeBulkModal() {
        bulkModal.classList.remove('open');
    }

    btnCloseBulkModal.addEventListener('click', closeBulkModal);
    btnCancelBulk.addEventListener('click', closeBulkModal);

    btnApplyBulk.addEventListener('click', () => {
        const text = bulkTextarea.value.trim();
        if (!text) {
            closeBulkModal();
            return;
        }

        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.startsWith('http://') || l.startsWith('https://'));

        if (lines.length === 0) {
            alert('Geçerli bir URL bulunamadı.');
            return;
        }

        // Mevcut boş satırları doldur, yetmezse yeni ekle
        const existingRows = linksList.querySelectorAll('.link-row');
        let lineIdx = 0;

        existingRows.forEach(row => {
            const input = row.querySelector('.row-input');
            if (!input.value.trim() && lineIdx < lines.length) {
                input.value = lines[lineIdx];
                updateRowStatus(row, 'idle', 'Hazır');
                lineIdx++;
            }
        });

        // Kalan linkler için yeni satır aç
        while (lineIdx < lines.length) {
            createRow(lines[lineIdx]);
            lineIdx++;
        }

        renumberRows();
        closeBulkModal();
    });

    // ==========================================================================
    // 7. DİĞER BUTON VE KONTROLLER
    // ==========================================================================
    btnAddRow.addEventListener('click', () => {
        createRow();
    });

    btnAddMoreRows.addEventListener('click', () => {
        for (let i = 0; i < 3; i++) {
            createRow();
        }
    });

    btnDownloadAll.addEventListener('click', () => {
        downloadAllRows();
    });

    btnClearCompleted.addEventListener('click', () => {
        const rows = linksList.querySelectorAll('.link-row');
        rows.forEach(r => {
            if (r.dataset.status === 'completed') {
                r.remove();
            }
        });
        renumberRows();
    });

    btnResetAll.addEventListener('click', () => {
        if (confirm('Tüm link listesini sıfırlamak istiyor musunuz?')) {
            initializeDefaultRows(6);
        }
    });

    btnRefreshPlaylists.addEventListener('click', () => {
        loadPlaylists();
    });

    btnOpenRootFolder.addEventListener('click', async () => {
        await openFolder('');
    });

    // İlk Başlatma
    initializeDefaultRows(6);
    loadPlaylists();
});
