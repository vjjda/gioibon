// Path: web/modules/tts/tts_player.js
import { TTSEngine } from 'tts/tts_engine.js';
import { TextProcessor } from 'tts/text_processor.js';
import { AudioResolver } from 'tts/audio_resolver.js';

export class TTSPlayer {
    constructor(dbConnection) {
        this.engine = new TTSEngine();
        this.textProcessor = new TextProcessor();
        this.audioResolver = new AudioResolver(this.engine, dbConnection);
        
        // Audio Element Reuse (Critical for Safari iOS Memory)
        this.audioElement = new Audio();
        this.audioQueue = [];
        this.isPlaying = false;
        this.isPaused = false;
        this.currentAudio = this.audioElement;
        
        this.currentSegmentId = null;
        this.isSequence = false;
        
        this.sequenceParentId = null;
        this.isLooping = false;
        this.currentPlaylist = [];

        this.onSegmentStart = null;
        this.onSegmentEnd = null;
        this.onPlaybackEnd = null;
        this.onPlaybackStateChange = null;
        
        // Session & Preload Management
        this.playbackSessionId = 0; 
        this.preloadMap = new Map();
        this.preloadDepth = 2;
        
        // [FIX iOS MEMORY LEAK] Theo dõi Blob URL đang phát để hủy bỏ khi bị ngắt quãng
        this.currentBlobUrl = null; 
    }

    // --- Configuration Proxies ---
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
        this._startNewSession();
        this.isSequence = false;
        const item = { id: segmentId, audio: audio, text: text };
        this.audioQueue = [item];
        this.currentPlaylist = [item];
        this._processQueue();
    }

    playSequence(segments, parentId = null) {
        if (this.isSequence && segments.length > 0 && this.currentPlaylist.length > 0 && 
            String(this.currentPlaylist[0].id) === String(segments[0].id) && (this.isPlaying || this.isPaused)) {
            this.togglePause();
            return;
        }
        this._startNewSession();
        this.isSequence = true;
        this.sequenceParentId = parentId; 
        this.audioQueue = [...segments];
        this.currentPlaylist = [...segments]; 
        this._processQueue();
    }

    pause() {
        if (!this.audioElement.paused) {
            this.audioElement.pause();
            this.isPaused = true;
            this.isPlaying = false;
            this._emitState('paused');
        }
    }

    resume() {
        if (this.audioElement.paused && this.isPaused) {
            this.audioElement.play();
            this.isPaused = false;
            this.isPlaying = true;
            this._emitState('playing');
        } else if (this.audioQueue.length > 0 && !this.isPlaying && !this.isPaused) {
            this._processQueue();
        }
    }

    togglePause() {
        this.isPaused ? this.resume() : this.pause();
    }

    stop() {
        this._cleanupSession();
        this.audioQueue = [];
        this.currentPlaylist = [];
        this.sequenceParentId = null;
        
        // Reset Audio Element
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.removeAttribute('src'); 
        this.audioElement.load();
        
        // [FIX iOS MEMORY LEAK] Xóa Blob file đang phát dở dang khỏi RAM
        this._revokeCurrentBlob();
        
        this.isPlaying = false;
        this.isPaused = false;
        this.currentSegmentId = null;
        this.isSequence = false;

        if (this.onPlaybackEnd) this.onPlaybackEnd();
        this._emitState('stopped');
    }

    // --- Session & Preload Management ---

    _startNewSession() {
        this._cleanupSession();
        this.playbackSessionId++; 
    }

    _cleanupSession() {
        for (const url of this.preloadMap.values()) {
            URL.revokeObjectURL(url);
        }
        this.preloadMap.clear();
    }

    _revokeCurrentBlob() {
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
    }

    _getCurrentSessionId() {
        return this.playbackSessionId;
    }

    // --- Queue Processing ---

    async _preloadNextItem() {
        if (this.audioQueue.length === 0) return;
        const currentSession = this.playbackSessionId;
        
        for (let i = 0; i < Math.min(this.preloadDepth, this.audioQueue.length); i++) {
            const nextItem = this.audioQueue[i];
            if (!this.preloadMap.has(nextItem.id)) {
                const result = await this.audioResolver.resolve(
                    nextItem, 
                    currentSession, 
                    () => this.playbackSessionId,
                    this.textProcessor
                );
                if (result && result.isBlob && this.playbackSessionId === currentSession) {
                    this.preloadMap.set(nextItem.id, result.url);
                }
            }
        }
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
        
        // [FIX iOS MEMORY LEAK] Xóa file ảo của câu trước đó trước khi phát câu mới
        this._revokeCurrentBlob();
        
        this.isPlaying = true;
        this._emitState('playing');

        const item = this.audioQueue.shift();
        this.currentSegmentId = item.id;

        if (this.onSegmentStart) this.onSegmentStart(item.id, this.isSequence);
        try {
            const currentSession = this.playbackSessionId;
            let audioSrc = null;
            let isBlob = false;

            if (this.preloadMap.has(item.id)) {
                audioSrc = this.preloadMap.get(item.id);
                isBlob = true;
                this.preloadMap.delete(item.id); 
            } else {
                const result = await this.audioResolver.resolve(
                    item, 
                    currentSession, 
                    () => this.playbackSessionId,
                    this.textProcessor
                );
                if (result) {
                    audioSrc = result.url;
                    isBlob = result.isBlob;
                }
            }

            if (currentSession !== this.playbackSessionId) return;
            if (!audioSrc) {
                this._handleSegmentEnd(item.id, null);
                return;
            }

            // [FIX iOS MEMORY LEAK] Lưu lại reference để xóa khi Stop hoặc sang câu mới
            if (isBlob) {
                this.currentBlobUrl = audioSrc;
            }

            this.audioElement.src = audioSrc;
            if (this.engine.rate) {
                this.audioElement.playbackRate = this.engine.rate;
            }

            const onEnd = () => {
                this._revokeCurrentBlob();
                this._handleSegmentEnd(item.id);
            };

            this.audioElement.onended = onEnd;
            this.audioElement.onerror = (e) => {
                console.error("Audio Playback Error:", e, audioSrc);
                onEnd();
            };

            await this.audioElement.play();
            this._preloadNextItem();
        } catch (error) {
            console.error("Playback error", error);
            this._handleSegmentEnd(item.id);
        }
    }

    _handleSegmentEnd(itemId) {
        if (this.onSegmentEnd) this.onSegmentEnd(itemId);
        this._processQueue();
    }

    _emitState(state) {
        if (this.onPlaybackStateChange) this.onPlaybackStateChange(state);
    }
}

