// Path: web/modules/core/config.js

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
    RATE: 1.0,
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const API_URLS = {
    TTS: "https://texttospeech.googleapis.com/v1/text:synthesize",
    VOICES: "https://texttospeech.googleapis.com/v1/voices"
};
