// Path: web/modules/services/audio_cache.js
const DB_NAME = 'tts_audio_cache';
const STORE_NAME = 'audios';
const DB_VERSION = 1;

export class AudioCache {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        if (this.db) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Key path là hash (chuỗi 16 ký tự)
                    db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("AudioCache IDB Error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Tạo hash SHA-256 giống hệt logic Python Backend (src/data_builder/tts_generator.py).
     * Logic: sha256(text|voice|lang).hexdigest()[:16]
     */
    async generateHash(text, voice, lang) {
        if (!text) return null;
        // Đảm bảo định dạng chuỗi giống hệt Python: "Text|Voice|Lang"
        const rawString = `${text}|${voice}|${lang}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(rawString);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex.substring(0, 16);
    }

    async get(hash) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(hash);

            request.onsuccess = () => {
                // Trả về blob nếu có, ngược lại null
                resolve(request.result ? request.result.blob : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async set(hash, blob) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const item = { 
                hash: hash, 
                blob: blob, 
                timestamp: Date.now() 
            };
            const request = store.put(item);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async has(hash) {
        const item = await this.get(hash);
        return !!item;
    }
}

export const audioCache = new AudioCache();
