// Path: web/modules/tts/audio_resolver.js
import { BASE_URL } from 'core/config.js';
import { audioCache } from 'services/audio_cache.js';

export class AudioResolver {
    constructor(engine) {
        this.engine = engine;
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

        // 1. DB Match (Ưu tiên số 1 - Nhanh nhất)
        if (item.audio === targetFilename) {
            return { url: `${BASE_URL}app-content/audio/${item.audio}`, isBlob: false };
        }

        // 2. Cache IDB Match
        if (await audioCache.has(targetHash)) {
            if (sessionId !== getCurrentSessionId()) return null; // Check session
            const blob = await audioCache.get(targetHash);
            return { url: URL.createObjectURL(blob), isBlob: true };
        }

        // 3. API Fetch
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

        // 4. Fallback (DB Mismatch)
        if (item.audio && item.audio !== 'skip') {
            return { url: `${BASE_URL}app-content/audio/${item.audio}`, isBlob: false };
        }

        return null;
    }
}
