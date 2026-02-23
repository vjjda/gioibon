// Path: web/utils/pwa.js
// Sử dụng module ảo của vite-plugin-pwa để quản lý Service Worker chuẩn xác
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import { BASE_URL } from 'core/config.js';

export function setupPWA() {
    console.log('[PWA] setupPWA called');

    // 1. Logic dọn dẹp cache và dữ liệu
    const clearCacheBtn = document.getElementById('btn-clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Bạn có chắc chắn muốn làm mới toàn bộ dữ liệu? Các cấu hình như API Key, font size và tốc độ đọc sẽ được giữ lại.')) {
                clearCacheBtn.disabled = true;
                clearCacheBtn.style.opacity = '0.5';

                try {
                    const keysToPreserve = [
                        'google_cloud_api_key',
                        'tts_voice_name',
                        'tts_rate',
                        'sutta_font_scale',
                        'sutta_theme',
                        'sutta_sepia_light',
                        'sutta_sepia_dark',
                        'sutta_loop_enabled',
                        'sutta_hint_mode_enabled'
                    ];

                    const backup = {};
                    keysToPreserve.forEach(key => {
                        const val = localStorage.getItem(key);
                        if (val !== null) backup[key] = val;
                    });

                    // Unregister SW
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                        }
                    }

                    // Clear Caches
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }

                    // Clear IDB
                    if (indexedDB.databases) {
                        const dbs = await indexedDB.databases();
                        dbs.forEach(db => {
                            if (db.name) indexedDB.deleteDatabase(db.name);
                        });
                    }

                    localStorage.clear();
                    sessionStorage.clear();
                    
                    Object.entries(backup).forEach(([key, val]) => {
                        localStorage.setItem(key, val);
                    });

                    window.location.reload();
                } catch (error) {
                    console.error('Lỗi khi xóa cache:', error);
                    alert('Đã xảy ra lỗi khi làm mới dữ liệu. Vui lòng thử lại.');
                    clearCacheBtn.disabled = false;
                    clearCacheBtn.style.opacity = '1';
                }
            }
        });
    }

    // 2. Logic thông báo cập nhật PWA và Data
    const toast = document.getElementById('pwa-toast');
    const refreshBtn = document.getElementById('pwa-refresh');
    const closeBtn = document.getElementById('pwa-close');
    const manualUpdateBtn = document.getElementById('btn-update-app');

    // Hàm hiển thị Toast dùng chung
    const showUpdateToast = () => {
        if (toast) toast.classList.remove('hidden');
        if (manualUpdateBtn) {
            manualUpdateBtn.classList.remove('rotating');
            manualUpdateBtn.classList.add('update-available');
            manualUpdateBtn.title = "Có bản cập nhật mới!";
        }
    };

    console.log('[PWA] Attempting to register SW unconditionally...');
    const updateSW = registerSW({
        onNeedRefresh() {
            console.log('[PWA] App update needed (SW)');
            showUpdateToast();
        },
        onOfflineReady() {
            console.log('[PWA] Offline ready');
        },
        onRegisterError(error) {
            console.error('[PWA] Registration error:', error);
        }
    });

    // --- HÀM KIỂM TRA DỮ LIỆU NGẦM ---
    const checkDataUpdateSilently = async () => {
        try {
            const versionUrl = `${BASE_URL}app-content/content_version.json?t=${Date.now()}`;
            const res = await fetch(versionUrl, { cache: 'no-store' });
            if (res.ok) {
                const remoteData = await res.json();
                const localVersion = localStorage.getItem('db_version_content.db');
                // Chỉ báo update nếu đã có localVersion (nghĩa là không phải lần đầu tải) 
                // và version trên server khác với local
                if (localVersion && remoteData.version !== localVersion) {
                    return true;
                }
            }
        } catch (e) {
            // Im lặng bỏ qua lỗi mạng khi check ngầm
        }
        return false;
    };

    // --- LẮNG NGHE SỰ KIỆN QUAY LẠI TAB (VISIBILITY CHANGE) ---
    // Tự động kiểm tra cả SW và Data mỗi khi người dùng mở lại tab ứng dụng
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            // 1. Kích hoạt Service Worker tự kiểm tra bản mới
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) reg.update();
            }
            
            // 2. Kiểm tra Data
            if (await checkDataUpdateSilently()) {
                console.log('[PWA] Data update found in background.');
                showUpdateToast();
            }
        }
    });

    if (toast && refreshBtn && closeBtn) {
        const handleUpdate = () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = "Đang tải...";
            closeBtn.disabled = true;

            // Yêu cầu Service Worker mới giành quyền kiểm soát
            updateSW(true);

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        refreshBtn.addEventListener('click', handleUpdate);
        
        // Nút check thủ công (dành cho người dùng muốn bấm trực tiếp)
        if (manualUpdateBtn) {
            manualUpdateBtn.addEventListener('click', async () => {
                if (!toast.classList.contains('hidden')) {
                    handleUpdate();
                    return;
                }

                manualUpdateBtn.classList.add('rotating');
                manualUpdateBtn.title = "Đang kiểm tra...";

                let hasUpdate = false;

                // 1. Kiểm tra Dữ liệu
                hasUpdate = await checkDataUpdateSilently();

                // 2. Kiểm tra App (Service Worker)
                try {
                    if ('serviceWorker' in navigator) {
                        const registration = await navigator.serviceWorker.getRegistration();
                        if (registration) {
                            await registration.update();
                            if (registration.installing || registration.waiting) {
                                hasUpdate = true;
                            }
                        }
                    }
                } catch (e) {
                    console.error("[PWA] Manual SW update check failed:", e);
                }

                if (hasUpdate) {
                    showUpdateToast();
                } else {
                    manualUpdateBtn.classList.remove('rotating');
                    manualUpdateBtn.title = "Kiểm tra & Cập nhật";
                    alert("Ứng dụng và dữ liệu đã ở phiên bản mới nhất.");
                }
            });
        }
        
        closeBtn.addEventListener('click', () => {
            toast.classList.add('hidden');
        });
    }
}