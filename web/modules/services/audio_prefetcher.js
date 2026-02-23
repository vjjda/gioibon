// Path: web/modules/services/audio_prefetcher.js
import { BASE_URL } from 'core/config.js';

/**
 * Tải ngầm các file âm thanh vào Service Worker Cache (Cache Storage)
 * Giúp ứng dụng hoạt động offline mà không làm nghẽn quá trình tải ban đầu.
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
            
            // Lấy toàn bộ danh sách segment có audio
            const allSegments = this.contentLoader.getAllSegments();
            const audioFiles = [...new Set(allSegments.map(s => s.audio).filter(a => a && a !== 'skip'))];

            let count = 0;
            // Tải ngầm từng file (Batch size = 3 để không nghẽn mạng)
            const BATCH_SIZE = 3;
            
            for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
                const batch = audioFiles.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (filename) => {
                    const fileUrl = `${BASE_URL}app-content/audio/${filename}`;
                    
                    // Kiểm tra xem đã có trong cache chưa
                    const cachedResponse = await cache.match(fileUrl);
                    if (!cachedResponse) {
                        try {
                            // Tải và đưa vào cache
                            await cache.add(fileUrl);
                            count++;
                        } catch (err) {
                            console.warn(`Không thể prefetch: ${fileUrl}`, err);
                        }
                    }
                }));

                // Tạm nghỉ 500ms giữa mỗi đợt để nhường CPU cho UI
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (count > 0) {
                console.log(`✅ Đã tải ngầm xong ${count} file âm thanh để dùng Offline.`);
            }
            
        } catch (error) {
            console.error("Lỗi khi chạy Audio Prefetcher:", error);
        } finally {
            this.isPrefetching = false;
        }
    }
}

