// Path: web/modules/tts/audio_resolver.js
import { BASE_URL } from 'core/config.js';
import { audioCache } from 'services/audio_cache.js';

export class AudioResolver {
    constructor(engine, dbConnection) {
        this.engine = engine;
        this.dbConnection = dbConnection;
    }

    /**
     * Resolve audio từ item (text/audio_path)
     * @param {object} item - {text, audio}
     * @param {string} sessionId - ID của session lúc bắt đầu gọi resolve
     * @param {function} getCurrentSessionId - Callback để lấy ID session hiện tại (dùng để check hủy)
     * @param {TextProcessor} textProcessor - Instance xử lý text
     * @returns { url: string, isBlob: boolean }
     */
    async resolve(item, sessionId, getCurrentSessionId, textProcessor) {
        // Normalize text
        const ttsText = await textProcessor.normalize(item.text);
        
        // Check session (early exit)
        if (sessionId !== getCurrentSessionId()) return null;

        if (!ttsText) return null;

        const currentVoice = this.engine.voice.name;
        const currentLang = this.engine.voice.languageCode;
        
        // Tính Hash
        const targetHash = await audioCache.generateHash(ttsText, currentVoice, currentLang);
        const targetFilename = `${targetHash}.mp3`;

        // 1. DB Match (Ưu tiên số 1 - Offline & Nhanh nhất)
        // Nếu tên file trong DB khớp với targetHash, nghĩa là DB có chứa blob của giọng đọc này
        if (item.audio === targetFilename && this.dbConnection) {
            try {
                // Query BLOB từ SQLite
                // item.id chính là uid trong bảng contents (hoặc cần mapping nếu khác)
                // Giả sử item.id khớp uid
                const result = await this.dbConnection.query(
                    "SELECT audio_blob FROM contents WHERE uid = ?", 
                    [item.id]
                );
                
                if (result && result.length > 0) {
                    const row = result[0];
                    // wa-sqlite trả về Uint8Array cho BLOB
                    let blobData = row.audio_blob; 
                    
                    // Nếu trả về object {audio_blob: ...} thì lấy value, 
                    // nếu là array [blob] (mode row) thì lấy index 0. 
                    // SqliteConnection.query trả về mảng các rows (objects).
                    
                    if (blobData) {
                        const blob = new Blob([blobData], { type: 'audio/mp3' });
                        return { url: URL.createObjectURL(blob), isBlob: true };
                    }
                }
            } catch (e) {
                console.error("DB Blob Fetch Error:", e);
            }
        }

        // 2. Cache IDB Match (Cho các giọng đọc custom không có trong DB)
        if (await audioCache.has(targetHash)) {
            if (sessionId !== getCurrentSessionId()) return null; // Check session
            const blob = await audioCache.get(targetHash);
            return { url: URL.createObjectURL(blob), isBlob: true };
        }

        // 3. API Fetch (Nếu DB không có và Cache không có)
        if (this.engine.hasApiKey()) {
            try {
                const blob = await this.engine.fetchAudioBlob(ttsText);
                if (sessionId !== getCurrentSessionId()) return null; // Check session

                await audioCache.set(targetHash, blob);
                return { url: URL.createObjectURL(blob), isBlob: true };
            } catch (e) {
                console.error("AudioResolver API Error:", e);
            }
        }

        // 4. Fallback (DB Audio Mismatch)
        // Nếu không có API Key, và DB có audio (dù khác giọng/hash), hãy dùng nó từ BLOB
        if (item.audio && item.audio !== 'skip' && this.dbConnection) {
             try {
                const result = await this.dbConnection.query(
                    "SELECT audio_blob FROM contents WHERE uid = ?", 
                    [item.id]
                );
                if (result && result.length > 0 && result[0].audio_blob) {
                    const blob = new Blob([result[0].audio_blob], { type: 'audio/mp3' });
                    return { url: URL.createObjectURL(blob), isBlob: true };
                }
            } catch (e) {
                console.error("DB Fallback Fetch Error:", e);
            }
        }

        return null;
    }
}
