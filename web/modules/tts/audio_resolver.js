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

        // 1. Static Folder Match (Offline PWA xử lý qua Service Worker Cache)
        // Trả về URL trực tiếp, tiết kiệm RAM cho iOS
        if (item.audio && item.audio !== 'skip') {
            return { url: `${BASE_URL}app-content/audio/${item.audio}`, isBlob: false };
        }

        // 2. Cache IDB Match (Cho những file tự sinh API lúc runtime)
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

        return null;
    }
}

