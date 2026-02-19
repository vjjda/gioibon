// Path: web/modules/tts/tts_player.js
import { TTSEngine } from 'tts/tts_engine.js';

export class TTSPlayer {
    constructor() {
        this.engine = new TTSEngine();
        this.audioQueue = [];
        this.isPlaying = false;
        this.isPaused = false;
        this.currentAudio = null;
        this.currentSegmentId = null;
        this.isSequence = false;
        
        // [NEW] Ghi nhớ ID của Heading cha tạo ra chuỗi này
        this.sequenceParentId = null; 
        
        // Theo dõi trạng thái lặp và lưu trữ playlist ban đầu
        this.isLooping = false;
        this.currentPlaylist = [];

        // Events
        this.onSegmentStart = null;
        this.onSegmentEnd = null;
        this.onPlaybackEnd = null;
        this.onPlaybackStateChange = null; 
    }

    // Proxy Engine Methods
    setApiKey(key) { this.engine.setApiKey(key); }
    getApiKey() { return this.engine.getApiKey(); }
    setVoice(name) { this.engine.setVoice(name); }
    setRate(rate) { this.engine.setRate(rate); }
    getVoices(force) { return this.engine.getVoices(force); }
    get currentVoice() { return this.engine.voice; }
    get currentRate() { return this.engine.rate; }

    // --- Playback Control ---

    playSegment(segmentId, audio, text) {
        if (String(this.currentSegmentId) === String(segmentId) && (this.isPlaying || this.isPaused)) {
            this.togglePause();
            return;
        }

        this.stop();
        this.isSequence = false;
        
        const item = { id: segmentId, audio: audio, text: text };
        this.audioQueue = [item];
        this.currentPlaylist = [item];

        this._processQueue();
    }

    // [UPDATED] Nhận thêm tham số parentId
    playSequence(segments, parentId = null) {
        if (this.isSequence && segments.length > 0 && this.currentPlaylist.length > 0 && 
            String(this.currentPlaylist[0].id) === String(segments[0].id) && (this.isPlaying || this.isPaused)) {
            this.togglePause();
            return;
        }

        this.stop();
        this.isSequence = true;
        this.sequenceParentId = parentId; // Lưu trữ Parent
        this.audioQueue = [...segments];
        this.currentPlaylist = [...segments]; 

        this._processQueue();
    }

    pause() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPaused = true;
            this.isPlaying = false;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange('paused');
        }
    }

    resume() {
        if (this.currentAudio && this.currentAudio.paused && this.isPaused) {
            this.currentAudio.play();
            this.isPaused = false;
            this.isPlaying = true;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange('playing');
        } else if (this.audioQueue.length > 0 && !this.isPlaying && !this.isPaused) {
            this._processQueue();
        }
    }

    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    stop() {
        this.audioQueue = [];
        this.currentPlaylist = [];
        this.sequenceParentId = null;
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentSegmentId = null;
        this.isSequence = false;

        if (this.onPlaybackEnd) this.onPlaybackEnd();
        if (this.onPlaybackStateChange) this.onPlaybackStateChange('stopped');
    }

    _normalizeText(text) {
        if (!text) return "";
        let clean = text.replace(/[()\[\]*]/g, ' ');
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
    }

    async _processQueue() {
        if (this.audioQueue.length === 0) {
            if (this.isLooping && this.currentPlaylist.length > 0) {
                this.audioQueue = [...this.currentPlaylist];
            } else {
                this.stop();
                return;
            }
        }

        if (this.isPaused) return;

        this.isPlaying = true;
        if (this.onPlaybackStateChange) this.onPlaybackStateChange('playing');

        const item = this.audioQueue.shift();
        this.currentSegmentId = item.id;

        if (this.onSegmentStart) this.onSegmentStart(item.id, this.isSequence);

        try {
            let audioSrc = null;

            if (item.audio && item.audio !== 'skip') {
                audioSrc = `data/audio/${item.audio}`;
            } else if (item.text) {
                const textWithoutHtml = item.text.replace(/<[^>]*>?/gm, '');
                const normalizedText = this._normalizeText(textWithoutHtml);
                
                if (normalizedText) {
                    audioSrc = await this.engine.fetchAudio(normalizedText);
                }
            }

            if (!audioSrc) {
                if (this.onSegmentEnd) this.onSegmentEnd(item.id);
                this._processQueue();
                return;
            }
            
            if (!this.isPlaying && !this.isPaused && this.audioQueue.length === 0 && !this.currentSegmentId) return;

            const audio = new Audio(audioSrc);
            this.currentAudio = audio;

            if (this.engine.rate) {
                audio.playbackRate = this.engine.rate;
            }

            audio.onended = () => {
                this.currentAudio = null;
                if (this.onSegmentEnd) this.onSegmentEnd(item.id);
                this._processQueue();
            };

            audio.onerror = (e) => {
                console.error("Audio Playback Error:", e, audioSrc);
                this.currentAudio = null;
                if (this.onSegmentEnd) this.onSegmentEnd(item.id);
                this._processQueue();
            };

            await audio.play();
        } catch (error) {
            console.error("Playback error", error);
            if (this.onSegmentEnd) this.onSegmentEnd(item.id);
            this._processQueue();
        }
    }
}

