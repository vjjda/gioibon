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

    playSegment(segmentId, text) {
        this.stop();
        this.audioQueue = [{ id: segmentId, text: text }];
        this._processQueue();
    }

    playSequence(segments) {
        this.stop();
        this.audioQueue = [...segments];
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
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentSegmentId = null;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        if (this.onPlaybackStateChange) this.onPlaybackStateChange('stopped');
    }

    async _processQueue() {
        if (this.audioQueue.length === 0) {
            this.stop();
            return;
        }

        if (this.isPaused) return;

        this.isPlaying = true;
        if (this.onPlaybackStateChange) this.onPlaybackStateChange('playing');

        const item = this.audioQueue.shift();
        this.currentSegmentId = item.id;

        if (this.onSegmentStart) this.onSegmentStart(item.id);

        try {
            const audioSrc = await this.engine.fetchAudio(item.text);
            
            if (!this.isPlaying && !this.isPaused && this.audioQueue.length === 0 && !this.currentSegmentId) return;

            const audio = new Audio(audioSrc);
            this.currentAudio = audio;

            audio.onended = () => {
                this.currentAudio = null;
                if (this.onSegmentEnd) this.onSegmentEnd(item.id);
                this._processQueue();
            };

            audio.onerror = (e) => {
                console.error("Audio Playback Error:", e);
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
