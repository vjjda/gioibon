// Path: web/modules/tts/tts_player.js
import { TTSEngine } from 'tts/tts_engine.js';
import { BASE_URL } from 'core/config.js';

export class TTSPlayer {
    constructor() {
        this.engine = new TTSEngine();
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

        // [NEW] Nạp bộ rules cấu hình
        this.ttsRules = null;
        this.rulesPromise = fetch(`${BASE_URL}data/tts_rules.json`)
            .then(res => res.json())
            .then(data => { this.ttsRules = data; })
            .catch(err => console.warn("Không tìm thấy tts_rules.json", err));
    }

    setApiKey(key) { this.engine.setApiKey(key); }
    getApiKey() { return this.engine.getApiKey(); }
    setVoice(name) { this.engine.setVoice(name); }
    setRate(rate) { this.engine.setRate(rate); }
    getVoices(force) { return this.engine.getVoices(force); }
    get currentVoice() { return this.engine.voice; }
    get currentRate() { return this.engine.rate; }

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

    playSequence(segments, parentId = null) {
        if (this.isSequence && segments.length > 0 && this.currentPlaylist.length > 0 && 
            String(this.currentPlaylist[0].id) === String(segments[0].id) && (this.isPlaying || this.isPaused)) {
            this.togglePause();
            return;
        }
        this.stop();
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

    // --- Format Text Helpers ---

    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _isUpper(text) {
        return text === text.toUpperCase() && text !== text.toLowerCase();
    }

    _capitalize(text) {
        if (!text) return text;
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    // [NEW] Áp dụng rules engine từ JSON
    async _applyTTSRules(text) {
        if (!text) return "";
        await this.rulesPromise;
        if (!this.ttsRules) return text;

        let ttsText = text;

        if (this.ttsRules.remove_html) {
            ttsText = ttsText.replace(/<[^>]*>?/gm, '');
        }
        if (this.ttsRules.remove_chars_regex) {
            ttsText = ttsText.replace(new RegExp(this.ttsRules.remove_chars_regex, 'g'), ' ');
        }
        if (this.ttsRules.collapse_spaces) {
            ttsText = ttsText.replace(/\s+/g, ' ').trim();
        }

        if (this.ttsRules.phonetics) {
            for (const [word, replacement] of Object.entries(this.ttsRules.phonetics)) {
                const regex = new RegExp(this._escapeRegExp(word), 'gi');
                ttsText = ttsText.replace(regex, replacement);
            }
        }

        if (this.ttsRules.capitalize_upper && this._isUpper(ttsText)) {
            ttsText = this._capitalize(ttsText);
        }

        return ttsText;
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
                audioSrc = `${BASE_URL}data/audio/${item.audio}`;
            } else if (item.text) {
                // Áp dụng bộ rules chuẩn hóa Text
                const ttsText = await this._applyTTSRules(item.text);

                if (ttsText) {
                    audioSrc = await this.engine.fetchAudio(ttsText);
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

