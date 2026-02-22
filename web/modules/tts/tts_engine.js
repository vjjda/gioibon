// Path: web/modules/tts/tts_engine.js
import { CONFIG_KEYS, DEFAULTS, API_URLS } from 'core/config.js';

export class TTSEngine {
    constructor() {
        this.apiKey = localStorage.getItem(CONFIG_KEYS.API_KEY) || '';
        this.cachedVoices = this._loadVoicesFromCache();
        
        this.voice = {
            languageCode: DEFAULTS.VOICE_LANG,
            name: localStorage.getItem(CONFIG_KEYS.TTS_VOICE) || DEFAULTS.VOICE_NAME
        };
        this.rate = parseFloat(localStorage.getItem(CONFIG_KEYS.TTS_RATE)) || DEFAULTS.RATE;
    }

    // --- Configuration ---
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem(CONFIG_KEYS.API_KEY, key);
    }
    
    getApiKey() { return this.apiKey; }

    hasApiKey() {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    setVoice(name, languageCode = 'vi-VN') {
        this.voice = { name, languageCode };
        localStorage.setItem(CONFIG_KEYS.TTS_VOICE, name);
    }

    setRate(rate) {
        this.rate = rate;
        localStorage.setItem(CONFIG_KEYS.TTS_RATE, rate);
    }

    // --- Voice Management ---
    _loadVoicesFromCache() {
        const cached = localStorage.getItem(CONFIG_KEYS.TTS_CACHE_LIST);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.warn("Failed to parse cached voices:", e);
            }
        }
        return [];
    }

    async getVoices(force = false) {
        if (!this.apiKey) return [];

        const lastUpdate = parseInt(localStorage.getItem(CONFIG_KEYS.TTS_CACHE_TS) || "0");
        const now = Date.now();

        if (!force && this.cachedVoices.length > 0 && (now - lastUpdate < DEFAULTS.CACHE_DURATION)) {
            console.log("Using cached voices.");
            return this.cachedVoices;
        }

        console.log("Fetching voices from API...");
        try {
            const response = await fetch(`${API_URLS.VOICES}?key=${this.apiKey}&languageCode=vi-VN`);
            if (!response.ok) {
                 if (this.cachedVoices.length > 0) {
                     console.warn("Fetch failed, using stale cache.");
                     return this.cachedVoices;
                 }
                 return [];
            }
            const data = await response.json();
            const voices = data.voices || [];
            
            const viVoices = voices.filter(v => v.languageCodes.includes('vi-VN'));
            
            if (viVoices.length > 0) {
                this.cachedVoices = viVoices;
                localStorage.setItem(CONFIG_KEYS.TTS_CACHE_LIST, JSON.stringify(viVoices));
                localStorage.setItem(CONFIG_KEYS.TTS_CACHE_TS, now.toString());
            }
            return viVoices;
        } catch (error) {
            console.error("Error fetching voices:", error);
            if (this.cachedVoices.length > 0) return this.cachedVoices;
            return [];
        }
    }

    // --- Audio Synthesis ---
    async fetchAudioBlob(text) {
        if (!this.apiKey) {
            throw new Error("Vui lòng nhập Google Cloud API Key trong phần Cài đặt.");
        }

        const payload = {
            input: { text: text },
            voice: {
                languageCode: this.voice.languageCode,
                name: this.voice.name
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: this.rate,
                pitch: 0.0
            }
        };

        try {
            const response = await fetch(`${API_URLS.TTS}?key=${this.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();
            if (data.audioContent) {
                 // Convert Base64 string to Blob manually to avoid browser compatibility issues with fetch(data:url)
                 const binaryString = atob(data.audioContent);
                 const bytes = new Uint8Array(binaryString.length);
                 for (let i = 0; i < binaryString.length; i++) {
                     bytes[i] = binaryString.charCodeAt(i);
                 }
                 return new Blob([bytes], { type: 'audio/mp3' });
            }
            throw new Error("No audio content received");
        } catch (error) {
            console.error("TTS Fetch Error:", error);
            throw error;
        }
    }

    async fetchAudio(text) {
        // Wrapper for backward compatibility (returns Data URI)
        const blob = await this.fetchAudioBlob(text);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
