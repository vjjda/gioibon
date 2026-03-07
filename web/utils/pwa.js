// Path: web/utils/pwa.js
// Sử dụng module ảo của vite-plugin-pwa để quản lý Service Worker chuẩn xác
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import { BASE_URL } from 'core/config.js';
import { CustomDialog } from 'ui/custom_dialog.js';

export function setupPWA() {
    console.log('[PWA] setupPWA called');

    // 1. Logic dọn dẹp cache và dữ liệu
    const clearCacheBtn = document.getElementById('btn-clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (await CustomDialog.confirm('Bạn có chắc chắn muốn làm mới toàn bộ dữ liệu? Các cấu hình như API Key, font size và tốc độ đọc sẽ được giữ lại.')) {
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
                        'sutta_hint_mode_enabled',
                        'sutta_normal_collapsed_ids',
                        'db_version_content.db'
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
                    CustomDialog.alert('Đã xảy ra lỗi khi làm mới dữ liệu. Vui lòng thử lại.', 'Lỗi');
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

    // [NEW] Biến lưu trữ version mới nhất và cờ trạng thái update
    let latestDataVersion = null;
    let isSWUpdateAvailable = false; // [FIX] Theo dõi xem có cập nhật Service Worker không

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
            isSWUpdateAvailable = true; // [FIX] Đánh dấu có SW Update
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
                latestDataVersion = remoteData.version; 
                
                const localVersion = localStorage.getItem('db_version_content.db');
                if (!localVersion) {
                    localStorage.setItem('db_version_content.db', latestDataVersion);
                    return false;
                }

                if (latestDataVersion !== localVersion) {
                    return true;
                }
            }
        } catch (e) {
            // Im lặng bỏ qua lỗi mạng khi check ngầm
        }
        return false;
    };

    // --- LẮNG NGHE SỰ KIỆN QUAY LẠI TAB ---
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) reg.update();
            }
            
            if (await checkDataUpdateSilently()) {
                console.log('[PWA] Data update found in background.');
                showUpdateToast();
            }
        }
    });

    if (toast && refreshBtn && closeBtn) {
        const handleUpdate = async () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = "Đang tải...";
            closeBtn.disabled = true;

            // Xử lý cập nhật version DB
            if (latestDataVersion) {
                localStorage.setItem('db_version_content.db', latestDataVersion);
                // [FIX] Nếu có dữ liệu mới, chủ động xóa cache cũ của DB (nếu có)
                if ('caches' in window) {
                    try {
                        await caches.delete('database-cache');
                    } catch (e) { console.warn("Failed to clear DB cache:", e); }
                }
            }

            // [FIX] Phân bổ việc tải lại trang hợp lý để tránh Race Condition
            if (isSWUpdateAvailable) {
                // Nhường cho PWA Plugin thực hiện tải lại trang khi SW đã take control
                updateSW(true);
            } else {
                // Chỉ là Data Update thuần túy, tự chúng ta load lại trang
                window.location.reload();
            }
        };

        refreshBtn.addEventListener('click', handleUpdate);
        
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
                                isSWUpdateAvailable = true; // [FIX] Ghi nhận SW đang đợi
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
                    CustomDialog.alert("Ứng dụng và dữ liệu đã ở phiên bản mới nhất.", "Thông báo");
                }
            });
        }
        
        closeBtn.addEventListener('click', () => {
            toast.classList.add('hidden');
        });
    }
}

