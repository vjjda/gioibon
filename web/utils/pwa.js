// Path: web/utils/pwa.js
import { registerSW } from 'virtual:pwa-register';

export function setupPWA() {
    let updateSWFunc;

    // 1. Lắng nghe cập nhật tự động từ Vite PWA
    try {
        updateSWFunc = registerSW({
            onNeedRefresh() {
                const toast = document.getElementById('pwa-toast');
                if (toast) {
                    toast.classList.remove('hidden');
                }
            },
            onOfflineReady() {
                console.log('App is ready to work offline');
            },
        });
    } catch (e) {
        console.warn("Lỗi đăng ký Service Worker:", e);
    }

    // Nút "Tải lại ngay" trên Toast
    const refreshBtn = document.getElementById('pwa-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            // Ngăn sự kiện click nổi bọt lọt ra ngoài (nếu có)
            e.preventDefault();
            e.stopPropagation();
            
            refreshBtn.innerHTML = 'Đang tải...';
            refreshBtn.disabled = true;

            try {
                if (updateSWFunc) {
                    await updateSWFunc(true); // Yêu cầu workbox nhảy sang bản mới
                }
            } catch (err) {
                console.error("Lỗi khi updateSW:", err);
            } finally {
                // Luôn ép tải lại trang dù cập nhật SW có lỗi hay không
                window.location.reload(true);
            }
        });
    }

    // Nút "Đóng" Toast
    const closeBtn = document.getElementById('pwa-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const toast = document.getElementById('pwa-toast');
            if (toast) toast.classList.add('hidden');
        });
    }

    // 2. Nút "Làm mới dữ liệu" thủ công trong Sidebar
    const clearCacheBtn = document.getElementById('btn-clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Hệ thống sẽ xóa dữ liệu cũ và tải lại. Bạn có chắc chắn không?')) {
                // Vô hiệu hóa nút để tránh click nhiều lần
                clearCacheBtn.disabled = true;
                clearCacheBtn.style.opacity = '0.5';

                try {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                        }
                    }

                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }

                    if (indexedDB.databases) {
                        const dbs = await indexedDB.databases();
                        dbs.forEach(db => {
                            if (db.name) indexedDB.deleteDatabase(db.name);
                        });
                    }

                    localStorage.clear();
                    sessionStorage.clear();

                    window.location.reload(true);
                } catch (error) {
                    console.error('Lỗi khi xóa cache:', error);
                    alert('Đã xảy ra lỗi khi làm mới dữ liệu. Vui lòng thử lại.');
                    clearCacheBtn.disabled = false;
                    clearCacheBtn.style.opacity = '1';
                }
            }
        });
    }
}