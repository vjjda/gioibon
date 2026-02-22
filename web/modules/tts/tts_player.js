// Path: web/modules/tts/tts_player.js
import { TTSEngine } from 'tts/tts_engine.js';
import { TextProcessor } from 'tts/text_processor.js';
import { AudioResolver } from 'tts/audio_resolver.js';

export class TTSPlayer {
    constructor(dbConnection) {
        this.engine = new TTSEngine();
        this.textProcessor = new TextProcessor();
        this.audioResolver = new AudioResolver(this.engine, dbConnection);
        
        this.audioQueue = [];
        this.isPlaying = false;
        this.isPaused = false;
        this.currentAudio = null;
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
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPaused = true;
            this.isPlaying = false;
            this._emitState('paused');
        }
    }

    resume() {
        if (this.currentAudio && this.currentAudio.paused && this.isPaused) {
            this.currentAudio.play();
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
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
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

    _getCurrentSessionId() {
        return this.playbackSessionId;
    }

    // --- Queue Processing ---

    async _preloadNextItem() {
        if (this.audioQueue.length === 0) return;

        const nextItem = this.audioQueue[0];
        if (!this.preloadMap.has(nextItem.id)) {
            const currentSession = this.playbackSessionId;
            
            // Delegate resolution to AudioResolver
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

    async _processQueue() {
        // 1. Check Queue Empty
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
        this._emitState('playing');

        const item = this.audioQueue.shift();
        this.currentSegmentId = item.id;

        if (this.onSegmentStart) this.onSegmentStart(item.id, this.isSequence);

        try {
            const currentSession = this.playbackSessionId;
            let audioSrc = null;
            let isBlob = false;

            // 2. Check Preload Map
            if (this.preloadMap.has(item.id)) {
                audioSrc = this.preloadMap.get(item.id);
                isBlob = true;
                this.preloadMap.delete(item.id); 
            } else {
                // 3. Resolve On-Demand via AudioResolver
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

            // 4. Create Audio & Play
            const audio = new Audio(audioSrc);
            this.currentAudio = audio;

            if (this.engine.rate) {
                audio.playbackRate = this.engine.rate;
            }

            // Define cleanup callback
            const onEnd = () => {
                if (isBlob) URL.revokeObjectURL(audioSrc);
                this.currentAudio = null;
                this._handleSegmentEnd(item.id);
            };

            audio.onended = onEnd;
            audio.onerror = (e) => {
                console.error("Audio Playback Error:", e, audioSrc);
                onEnd();
            };

            await audio.play();

            // 5. Trigger Preload Next
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
