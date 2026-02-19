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

    playSegment(segmentId, audio, text) {
        this.stop();
        this.audioQueue = [{ id: segmentId, audio: audio, text: text }];
        this._processQueue();
    }

    playSequence(segments) {
        this.stop();
        // segments is array of { id, audio, text }
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
            let audioSrc = null;
            
            // Priority: Pre-generated Audio File > Text-to-Speech
            if (item.audio && item.audio !== 'skip') {
                audioSrc = `data/audio/${item.audio}`;
            } else if (item.text) {
                // Remove HTML/Markdown from text if needed? 
                // For now, assume engine handles it or text is clean enough.
                // Or user might have stripped it before.
                // The DB 'segment' column has markdown.
                // Let's do a simple strip if using TTS fallback.
                const cleanText = item.text.replace(/<[^>]*>?/gm, '').replace(/\*+/g, '');
                audioSrc = await this.engine.fetchAudio(cleanText);
            }

            if (!audioSrc) {
                // If no audio source found (e.g. skip + no text), skip to next
                if (this.onSegmentEnd) this.onSegmentEnd(item.id);
                this._processQueue();
                return;
            }
            
            if (!this.isPlaying && !this.isPaused && this.audioQueue.length === 0 && !this.currentSegmentId) return;

            const audio = new Audio(audioSrc);
            this.currentAudio = audio;

            // Handle rate for HTML5 Audio (if supported)
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
