// Path: web/modules/core/config.js

// [UPDATED] Hỗ trợ cả Vite (import.meta.env) và môi trường phát triển đơn giản (make simple)
export const BASE_URL = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';

export const CONFIG_KEYS = {
    API_KEY: 'google_cloud_api_key',
    TTS_VOICE: 'tts_voice_name',
    TTS_RATE: 'tts_rate',
    TTS_CACHE_LIST: 'tts_gcloud_voices_list',
    TTS_CACHE_TS: 'tts_gcloud_voices_ts'
};

export const DEFAULTS = {
    VOICE_LANG: 'vi-VN',
    VOICE_NAME: 'vi-VN-Chirp3-HD-Charon',
    RATE: 1.5,
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const API_URLS = {
    TTS: "https://texttospeech.googleapis.com/v1/text:synthesize",
    VOICES: "https://texttospeech.googleapis.com/v1/voices"
};

export const UI_CONFIG = {
    // Khoảng cách an toàn (Sight View) - hỗ trợ 'px' hoặc '%vh'
    // SCROLL_THRESHOLD_TOP: Tính từ mép dưới của Header
    SCROLL_THRESHOLD_TOP: '10vh', 
    // SCROLL_THRESHOLD_BOTTOM: Tính từ mép trên của Global Controls
    SCROLL_THRESHOLD_BOTTOM: '15vh',
    
    // Chiều cao thành phần cố định (dùng để trừ hao)
    HEADER_HEIGHT: 70, // khớp với --header-height
    FOOTER_OFFSET: 100, // Khoảng cách trừ hao cho Global Controls ở dưới
    
    SCROLL_BEHAVIOR: 'smooth'
};
