// Path: web/utils/pwa.js
import { registerSW } from 'virtual:pwa-register';

export function setupPWA() {
    // 1. Lắng nghe cập nhật tự động từ Vite PWA
    const updateSW = registerSW({
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

    // Nút "Tải lại ngay" trên Toast
    const refreshBtn = document.getElementById('pwa-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            updateSW(true);
        });
    }

    // Nút "Đóng" Toast
    const closeBtn = document.getElementById('pwa-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const toast = document.getElementById('pwa-toast');
            if (toast) toast.classList.add('hidden');
        });
    }

    // 2. Nút "Làm mới dữ liệu" thủ công trong Sidebar
    const clearCacheBtn = document.getElementById('btn-clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Hệ thống sẽ xóa dữ liệu cũ và tải lại. Bạn có chắc chắn không?')) {
                clearCacheBtn.innerHTML = 'Đang dọn dẹp...';
                clearCacheBtn.disabled = true;

                try {
                    // Hủy đăng ký toàn bộ Service Workers
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                        }
                    }

                    // Xóa bộ nhớ đệm (Cache Storage)
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }

                    // Xóa toàn bộ CSDL IndexedDB (bao gồm DB của wa-sqlite)
                    if (indexedDB.databases) {
                        const dbs = await indexedDB.databases();
                        dbs.forEach(db => {
                            if (db.name) indexedDB.deleteDatabase(db.name);
                        });
                    }

                    // Xóa Local/Session Storage
                    localStorage.clear();
                    sessionStorage.clear();

                    // Ép trình duyệt tải lại từ Server (Bypass cache)
                    window.location.reload(true);
                } catch (error) {
                    console.error('Lỗi khi xóa cache:', error);
                    alert('Đã xảy ra lỗi khi làm mới dữ liệu. Vui lòng thử lại.');
                    clearCacheBtn.innerHTML = '🔄 Cập nhật dữ liệu mới';
                    clearCacheBtn.disabled = false;
                }
            }
        });
    }
}