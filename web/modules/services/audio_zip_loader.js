// Path: web/modules/services/audio_zip_loader.js
import { BASE_URL } from 'core/config.js';

/**
 * Tải ngầm file audio.zip, giải nén và đưa thẳng vào Service Worker Cache (Cache Storage)
 * Giúp ứng dụng hoạt động offline mượt mà và giảm thiểu RTT đáng kể.
 */
export class AudioZipLoader {
    constructor(contentLoader) {
        this.contentLoader = contentLoader;
        this.isProcessing = false;
        this.cacheName = 'audio-mp3-cache'; // Trùng khớp với tên trong vite.config.js
    }

    async loadAndInject() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // Đảm bảo Cache Storage đã sẵn sàng
            if (!('caches' in window)) return;
            const cache = await caches.open(this.cacheName);
            
            // 1. Lấy danh sách segment có audio từ DB hiện tại
            const allSegments = this.contentLoader.getAllSegments();
            const requiredAudioFiles = [...new Set(allSegments.map(s => s.audio).filter(a => a && a !== 'skip'))];

            // ==========================================
            // BƯỚC 1: DỌN DẸP CACHE RÁC
            // ==========================================
            const cachedRequests = await cache.keys();
            let deletedCount = 0;
            const existingCacheKeys = new Set();

            for (const request of cachedRequests) {
                const url = new URL(request.url);
                const filename = url.pathname.split('/').pop();

                // Nếu file trong cache là mp3 nhưng không nằm trong DB mới -> XÓA
                if (filename && filename.endsWith('.mp3')) {
                    if (!requiredAudioFiles.includes(filename)) {
                        await cache.delete(request);
                        deletedCount++;
                    } else {
                        existingCacheKeys.add(filename);
                    }
                }
            }

            if (deletedCount > 0) {
                console.log(`🗑️ Đã dọn dẹp ${deletedCount} file audio cũ khỏi Cache.`);
            }

            // ==========================================
            // BƯỚC 2: KIỂM TRA FILE THIẾU
            // ==========================================
            const missingFiles = requiredAudioFiles.filter(f => !existingCacheKeys.has(f));
            if (missingFiles.length === 0) {
                console.log(`✨ Toàn bộ dữ liệu âm thanh đã sẵn sàng (Cached).`);
                return;
            }

            console.log(`⬇️ Thiếu ${missingFiles.length} file. Bắt đầu tải và giải nén audio.zip...`);

            // ==========================================
            // BƯỚC 3: TẢI VÀ GIẢI NÉN ZIP
            // ==========================================
            // Sử dụng cache busting để đảm bảo luôn tải ZIP mới nhất
            const zipUrl = `${BASE_URL}app-content/audio.zip?t=${Date.now()}`;
            let response;
            
            try {
                response = await fetch(zipUrl);
            } catch (fetchError) {
                // Xử lý êm ái khi đang offline (mất mạng sẽ ném lỗi TypeError ở đây)
                console.warn(`⚠️ Đang ngoại tuyến hoặc lỗi kết nối. Sẽ tải audio.zip sau. (${fetchError.message})`);
                return;
            }
            
            if (!response.ok) {
                console.warn(`⚠️ Không thể tải audio.zip (${response.status}). Sẽ tải lại sau.`);
                return;
            }

            let blob = await response.blob();
            
            // Lấy đối tượng JSZip từ global window
            const JSZip = window.JSZip;
            if (!JSZip) {
                console.error("❌ Thư viện JSZip chưa được tải vào global.");
                blob = null; // Giải phóng bộ nhớ
                return;
            }

            let jszip = new JSZip();
            let zip = await jszip.loadAsync(blob);
            
            // Ép dọn dẹp biến blob khổng lồ do JSZip đã parse xong
            blob = null; 
            
            let injectedCount = 0;

            // ==========================================
            // BƯỚC 4: BƠM FILE VÀO CACHE STORAGE
            // ==========================================
            for (const filename of missingFiles) {
                const zipEntry = zip.file(filename);
                if (zipEntry) {
                    const audioBlob = await zipEntry.async("blob");
                    
                    // Tạo một Response giả lập để đưa vào Cache Storage.
                    // URL này phải khớp ĐÚNG với định dạng URL mà ứng dụng gọi khi phát MP3.
                    const fileUrl = `${window.location.origin}${BASE_URL}app-content/audio/${filename}`;
                    
                    const res = new Response(audioBlob, {
                        status: 200,
                        statusText: 'OK',
                        headers: {
                            'Content-Type': 'audio/mpeg',
                            'Content-Length': audioBlob.size.toString(),
                            'Accept-Ranges': 'bytes', // [FIX] Hỗ trợ Safari iOS
                            'Cache-Control': 'max-age=31536000' // Cho phép cache vĩnh viễn (1 năm)
                        }
                    });

                    await cache.put(fileUrl, res);
                    injectedCount++;
                    
                    // [FIX iOS CRASH] Ép JS nhường Main Thread mỗi chu kỳ 
                    // để hệ điều hành kích hoạt Garbage Collection, tránh tràn RAM
                    if (injectedCount % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 30));
                    }
                }
            }
            
            // Xóa sổ toàn bộ JSZip object khỏi RAM sau khi xong việc
            zip = null;
            jszip = null;

            console.log(`✅ Đã giải nén và lưu trực tiếp ${injectedCount} file âm thanh vào Cache để dùng Offline.`);

        } catch (error) {
            console.error("❌ Lỗi khi chạy Audio Zip Loader:", error);
        } finally {
            this.isProcessing = false;
        }
    }
}