// Path: web/modules/ui/content_renderer.js
import { SegmentFactory } from 'ui/content/segment_factory.js';
import { MaskManager } from 'ui/content/mask_manager.js';

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        this.items = [];
        this.hoveredSegmentId = null;

        this.maskManager = new MaskManager(this.container);
        this.segmentFactory = new SegmentFactory({
            playSegment: this.playSegmentCallback,
            playSequence: (index) => this._handlePlaySequence(index),
            onMaskStart: (e, el, item) => this.maskManager.handleMaskStart(e, el, item),
            onMaskEnter: (e, el) => this.maskManager.handleMaskEnter(e, el),
            onHover: (id) => { this.hoveredSegmentId = id; }
        });

        this._setupKeyboardListeners();
    }

    _setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const key = e.key.toLowerCase();
            if (key === 'r') {
                this._handleKeyboardPlay();
            } else if (key === 'f') {
                this._handleKeyboardFlip();
            }
        });
    }

    render(items) {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.items = items || [];
        this.maskManager.setItems(this.items);
        
        if (!this.items || this.items.length === 0) {
            this.container.innerHTML = '<div class="empty">Không có dữ liệu hiển thị.</div>';
            return;
        }

        let currentSection = null;
        let currentPrefix = null;

        this.items.forEach((item, index) => {
            let prefix = 'misc';
            if (['title', 'subtitle', 'nidana'].includes(item.label)) {
                prefix = 'intro';
            } else if (item.label === 'end') {
                prefix = 'outro';
            } else if (item.label.startsWith('note')) {
                prefix = currentPrefix || 'intro'; 
            } else {
                const match = item.label.match(/^([a-z]+)/);
                if (match) {
                    prefix = match[1];
                }
            }
            
            const isSectionStart = 
                (prefix !== currentPrefix) || 
                (item.label.endsWith('-chapter')) ||
                (item.label === 'title');

            if (isSectionStart || !currentSection) {
                currentPrefix = prefix;
                currentSection = document.createElement('section');
                currentSection.className = `section section-${prefix}`;
                currentSection.id = `section-${item.label}`;
                this.container.appendChild(currentSection);
            }

            const segmentEl = this.segmentFactory.create(item, index);
            currentSection.appendChild(segmentEl);
        });
    }

    _handlePlaySequence(startIndex) {
        if (!this.playSequenceCallback) return;
        
        const startItem = this.items[startIndex];
        const match = startItem.html ? startItem.html.match(/^<h(\d)>/i) : null;
        if (!match) return; 
        const startLevel = parseInt(match[1]);

        const sequence = [];

        for (let i = startIndex + 1; i < this.items.length; i++) {
            const item = this.items[i];
            
            if (item.label === 'end') break; 

            const itemMatch = item.html ? item.html.match(/^<h(\d)>/i) : null;
            if (itemMatch) {
                const itemLevel = parseInt(itemMatch[1]);
                if (itemLevel <= startLevel) {
                    break;
                }
            }

            if (item.audio && item.audio !== 'skip') {
                sequence.push({ id: item.id, audio: item.audio, text: item.segment });
            }
        }
        
        if (sequence.length > 0) {
            this.playSequenceCallback(sequence, startItem.id);
        } else {
            alert("Không có dữ liệu âm thanh cho phần này.");
        }
    }

    _handleKeyboardPlay() {
        if (!this.hoveredSegmentId) return;
        const item = this.items.find(i => i.id === this.hoveredSegmentId);
        if (!item) return;

        if (item.html && item.html.match(/^<h[1-6]/i)) {
            const index = this.items.indexOf(item);
            this._handlePlaySequence(index);
        } else {
            if (item.audio && item.audio !== 'skip' && this.playSegmentCallback) {
                this.playSegmentCallback(item.id, item.audio, item.segment);
            }
        }
    }

    _handleKeyboardFlip() {
        if (!this.hoveredSegmentId) return;
        const item = this.items.find(i => i.id === this.hoveredSegmentId);
        if (!item) return;

        const segmentEl = this.container.querySelector(`.segment[data-id="${this.hoveredSegmentId}"]`);
        if (segmentEl) {
            const hasAudio = item.audio && item.audio !== 'skip';
            // [UPDATED] Hỗ trợ lật thẻ bằng phím 'f' cho cả Heading
            const isHeading = item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
            
            if (hasAudio || isHeading) {
                this.maskManager.toggleMask(segmentEl, item);
            }
        }
    }

    highlightSegment(id, shouldScroll = true) {
        if (!this.container) return;
        const prevActive = this.container.querySelector('.segment.active');
        if (prevActive) prevActive.classList.remove('active');

        const activeEl = this.container.querySelector(`.segment[data-id="${id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            if (shouldScroll) {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                activeEl.scrollIntoView({ 
                    behavior: isMobile ? 'auto' : 'smooth', 
                    block: 'center' 
                });
            }
        }
    }

    clearHighlight() {
        if (!this.container) return;
        this.container.querySelectorAll('.segment').forEach(el => el.classList.remove('active'));
    }

    updatePlaybackState(state, activeSegmentId, isSequence, sequenceParentId) {
        this.container.querySelectorAll('.play-btn:not(.play-sequence-btn)').forEach(btn => {
            btn.classList.remove('active-play');
            btn.innerHTML = '<i class="fas fa-circle"></i>';
            btn.title = "Nghe đoạn này";
        });
        
        this.container.querySelectorAll('.play-sequence-btn').forEach(btn => {
            btn.classList.remove('active-play');
            btn.innerHTML = '<i class="fas fa-play-circle"></i>';
            btn.title = "Nghe toàn bộ phần này";
        });

        if (!activeSegmentId || state === 'stopped') return;

        const activeEl = this.container.querySelector(`.segment[data-id="${activeSegmentId}"]`);
        if (!activeEl) return;

        const segmentBtn = activeEl.querySelector('.play-btn:not(.play-sequence-btn)');
        if (segmentBtn) {
            segmentBtn.classList.add('active-play');
            segmentBtn.innerHTML = state === 'playing' ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
            segmentBtn.title = state === 'playing' ? "Tạm dừng" : "Tiếp tục";
        }

        if (isSequence && sequenceParentId) {
            const parentEl = this.container.querySelector(`.segment[data-id="${sequenceParentId}"]`);
            if (parentEl) {
                const seqBtn = parentEl.querySelector('.play-sequence-btn');
                if (seqBtn) {
                    seqBtn.classList.add('active-play');
                    seqBtn.innerHTML = state === 'playing' ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
                    seqBtn.title = state === 'playing' ? "Tạm dừng" : "Tiếp tục";
                }
            }
        }
    }

    getFirstVisibleSegmentId() {
        if (!this.container) return null;
        const segments = this.container.querySelectorAll('.segment');
        for (const segment of segments) {
            const rect = segment.getBoundingClientRect();
            if (rect.top + rect.height > 80 && rect.top < window.innerHeight) {
                if (parseInt(segment.dataset.id)) {
                    return parseInt(segment.dataset.id);
                }
            }
        }
        return null;
    }
}

