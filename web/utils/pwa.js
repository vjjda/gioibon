// Path: web/utils/pwa.js
// Sử dụng module ảo của vite-plugin-pwa để quản lý Service Worker chuẩn xác
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

export function setupPWA() {
    console.log('[PWA] setupPWA called');
    // 1. Logic dọn dẹp cache và dữ liệu (Giữ nguyên logic cũ)
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

    // 2. Logic thông báo cập nhật PWA (Sử dụng virtual:pwa-register)
    const toast = document.getElementById('pwa-toast');
    const refreshBtn = document.getElementById('pwa-refresh');
    const closeBtn = document.getElementById('pwa-close');
    const manualUpdateBtn = document.getElementById('btn-update-app');

    console.log('[PWA] Attempting to register SW unconditionally...');
    
    // Register SW unconditionally
    const updateSW = registerSW({
        onNeedRefresh() {
            console.log('[PWA] Need refresh');
            if (toast) toast.classList.remove('hidden');
            if (manualUpdateBtn) manualUpdateBtn.classList.add('update-available');
        },
        onOfflineReady() {
            console.log('[PWA] Offline ready');
        },
        onRegisterError(error) {
            console.error('[PWA] Registration error:', error);
        }
    });

    if (toast && refreshBtn && closeBtn) {
        console.log('[PWA] Found toast elements, binding events...');
        
        const handleUpdate = () => {
            // [iOS FIX] Vô hiệu hóa nút và báo hiệu đang xử lý để tránh người dùng bấm nhiều lần
            refreshBtn.disabled = true;
            refreshBtn.textContent = "Đang tải...";
            closeBtn.disabled = true;

            // Yêu cầu Service Worker mới giành quyền kiểm soát
            updateSW(true);

            // [iOS FIX] Fallback ép trình duyệt tải lại trang sau 1 giây.
            // Giải quyết triệt để lỗi Safari trên iOS không bắn sự kiện `controllerchange`,
            // khiến giao diện bị "đóng băng" không thể thao tác tiếp.
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        refreshBtn.addEventListener('click', handleUpdate);
        
        if (manualUpdateBtn) {
            manualUpdateBtn.addEventListener('click', async () => {
                // 1. Nếu toast đang hiện (nghĩa là đã có update chờ sẵn)
                if (!toast.classList.contains('hidden')) {
                    handleUpdate();
                    return;
                }

                // 2. Nếu chưa có update, thực hiện check thủ công
                manualUpdateBtn.classList.add('rotating');
                manualUpdateBtn.title = "Đang kiểm tra...";

                try {
                    if ('serviceWorker' in navigator) {
                        const registration = await navigator.serviceWorker.getRegistration();
                        if (registration) {
                            await registration.update();
                            // Sau khi update, nếu có bản mới, onNeedRefresh sẽ tự kích hoạt toast
                            // Chúng ta đợi 2s để tạo cảm giác "đang check"
                            setTimeout(() => {
                                manualUpdateBtn.classList.remove('rotating');
                                manualUpdateBtn.title = "Kiểm tra & Cập nhật";
                                if (toast.classList.contains('hidden')) {
                                    alert("Ứng dụng và dữ liệu đã ở phiên bản mới nhất.");
                                }
                            }, 1500);
                        }
                    }
                } catch (e) {
                    console.error("Manual update check failed:", e);
                    manualUpdateBtn.classList.remove('rotating');
                }
            });
        }
        
        closeBtn.addEventListener('click', () => {
            toast.classList.add('hidden');
        });
    }
}

