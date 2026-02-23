// Path: web/modules/services/audio_prefetcher.js
import { BASE_URL } from 'core/config.js';

/**
 * Tải ngầm các file âm thanh vào Service Worker Cache (Cache Storage)
 * Giúp ứng dụng hoạt động offline và dọn dẹp các file cũ không còn sử dụng.
 */
export class AudioPrefetcher {
    constructor(contentLoader) {
        this.contentLoader = contentLoader;
        this.isPrefetching = false;
        this.cacheName = 'audio-mp3-cache'; // Trùng khớp với tên trong vite.config.js
    }

    async startPrefetch() {
        if (this.isPrefetching) return;
        this.isPrefetching = true;

        try {
            // Đảm bảo Workbox Cache đã sẵn sàng
            if (!('caches' in window)) return;
            const cache = await caches.open(this.cacheName);
            
            // 1. Lấy danh sách segment có audio từ DB hiện tại
            const allSegments = this.contentLoader.getAllSegments();
            const requiredAudioFiles = [...new Set(allSegments.map(s => s.audio).filter(a => a && a !== 'skip'))];

            // ==========================================
            // BƯỚC 1: DỌN DẸP CACHE RÁC (GARBAGE COLLECTION)
            // ==========================================
            const cachedRequests = await cache.keys();
            let deletedCount = 0;

            for (const request of cachedRequests) {
                const url = new URL(request.url);
                const filename = url.pathname.split('/').pop();

                // Nếu file trong cache là mp3 nhưng không nằm trong DB mới -> XÓA
                if (filename && filename.endsWith('.mp3') && !requiredAudioFiles.includes(filename)) {
                    await cache.delete(request);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🗑️ Đã dọn dẹp ${deletedCount} file audio cũ khỏi Cache.`);
            }

            // ==========================================
            // BƯỚC 2: TẢI NGẦM CÁC FILE CÒN THIẾU
            // ==========================================
            let downloadedCount = 0;
            const BATCH_SIZE = 3; // Tải 3 file cùng lúc để không nghẽn mạng
            
            for (let i = 0; i < requiredAudioFiles.length; i += BATCH_SIZE) {
                const batch = requiredAudioFiles.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (filename) => {
                    const fileUrl = `${BASE_URL}app-content/audio/${filename}`;
                    
                    // Kiểm tra xem đã có trong cache chưa
                    const cachedResponse = await cache.match(fileUrl);
                    if (!cachedResponse) {
                        try {
                            // Tải và đưa vào cache
                            await cache.add(fileUrl);
                            downloadedCount++;
                        } catch (err) {
                            console.warn(`⚠️ Không thể prefetch: ${fileUrl}`, err);
                        }
                    }
                }));

                // Tạm nghỉ 500ms giữa mỗi đợt để nhường CPU cho UI
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (downloadedCount > 0) {
                console.log(`✅ Đã tải ngầm xong ${downloadedCount} file âm thanh mới để dùng Offline.`);
            } else {
                console.log(`✨ Toàn bộ dữ liệu âm thanh đã sẵn sàng (Cached).`);
            }
            
        } catch (error) {
            console.error("❌ Lỗi khi chạy Audio Prefetcher:", error);
        } finally {
            this.isPrefetching = false;
        }
    }
}

