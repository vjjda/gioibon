// Path: web/modules/tts/audio_resolver.js
import { BASE_URL } from 'core/config.js';
import { audioCache } from 'services/audio_cache.js';

export class AudioResolver {
    constructor(engine, dbConnection) {
        this.engine = engine;
        this.dbConnection = dbConnection;
    }

    async resolve(item, sessionId, getCurrentSessionId, textProcessor) {
        // Normalize text
        const ttsText = await textProcessor.normalize(item.text);
        if (sessionId !== getCurrentSessionId()) return null;
        if (!ttsText) return null;

        const currentVoice = this.engine.voice.name;
        const currentLang = this.engine.voice.languageCode;
        const targetHash = await audioCache.generateHash(ttsText, currentVoice, currentLang);
        const targetFilename = `${targetHash}.mp3`;

        // 1. DB Match (Ưu tiên số 1 - Offline & Nhanh nhất)
        if (item.audio === targetFilename && this.dbConnection) {
            try {
                // [FIX] Truy vấn vào bảng audios thông qua audio_name thay vì uid
                const result = await this.dbConnection.query(
                    "SELECT audio_blob FROM audios WHERE audio_name = ?", 
                    [item.audio]
                );
                
                if (result && result.length > 0) {
                    let blobData = result[0].audio_blob;
                    if (blobData) {
                        const blob = new Blob([blobData], { type: 'audio/mp3' });
                        return { url: URL.createObjectURL(blob), isBlob: true };
                    }
                }
            } catch (e) {
                console.error("DB Blob Fetch Error:", e);
            }
        }

        // 2. Cache IDB Match
        if (await audioCache.has(targetHash)) {
            if (sessionId !== getCurrentSessionId()) return null;
            const blob = await audioCache.get(targetHash);
            return { url: URL.createObjectURL(blob), isBlob: true };
        }

        // 3. API Fetch
        if (this.engine.hasApiKey()) {
            try {
                const blob = await this.engine.fetchAudioBlob(ttsText);
                if (sessionId !== getCurrentSessionId()) return null; 

                await audioCache.set(targetHash, blob);
                return { url: URL.createObjectURL(blob), isBlob: true };
            } catch (e) {
                console.error("AudioResolver API Error:", e);
            }
        }

        // 4. Fallback (DB Audio Mismatch)
        if (item.audio && item.audio !== 'skip' && this.dbConnection) {
             try {
                // [FIX] Truy vấn vào bảng audios
                const result = await this.dbConnection.query(
                    "SELECT audio_blob FROM audios WHERE audio_name = ?", 
                    [item.audio]
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

