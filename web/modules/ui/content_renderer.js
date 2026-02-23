// Path: web/modules/ui/content_renderer.js
import { SegmentFactory } from 'ui/content/segment_factory.js';
import { MaskManager } from 'ui/content/mask_manager.js';
import { ScrollManager } from 'ui/content/scroll_manager.js';
import { KeyboardHandler } from 'ui/content/keyboard_handler.js';

const BATCH_SIZE = 60;

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        
        this.items = [];
        this.hoveredSegmentId = null;
        this.elementCache = new Map();

        // Lazy Loading State
        this.renderedCount = 0;
        this.observer = null;
        this.sentinel = null;
        this.currentPrefix = null; 
        this.isRendering = false;

        // --- Sub-modules (Composition) ---
        this.maskManager = new MaskManager(this.container);
        
        this.segmentFactory = new SegmentFactory({
            playSegment: this.playSegmentCallback,
            playSequence: (index) => this.playSequenceFromIndex(index),
            onMaskStart: (e, el, item) => this.maskManager.handleMaskStart(e, el, item),
            onMaskEnter: (e, el) => this.maskManager.handleMaskEnter(e, el),
            onHover: (id) => { this.hoveredSegmentId = id; }
        });

        this.scrollManager = new ScrollManager(
            this.container,
            this.elementCache,
            () => this.items,
            (targetIndex) => this._ensureRendered(targetIndex)
        );

        this.keyboardHandler = new KeyboardHandler(
            () => this.hoveredSegmentId,
            () => this.items,
            () => this.elementCache,
            this.maskManager,
            this.playSegmentCallback,
            (index) => this.playSequenceFromIndex(index)
        );
    }

    render(items) {
        if (!this.container) return;
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.container.innerHTML = '';
        this.elementCache.clear();
        this.scrollManager.clearHighlight();
        this.renderedCount = 0;
        this.currentPrefix = null;
        this.sentinel = null;
        this.isRendering = false;

        this.items = items || [];
        this.maskManager.setItems(this.items);
        
        if (!this.items || this.items.length === 0) {
            this.container.innerHTML = '<div class="empty">Không có dữ liệu hiển thị.</div>';
            return;
        }

        this.sentinel = document.createElement('div');
        this.sentinel.className = 'loading-sentinel';
        this.sentinel.style.height = '50px';
        this.sentinel.style.width = '100%';
        this.container.appendChild(this.sentinel);
        
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (!this.isRendering) {
                    this.isRendering = true;
                    requestAnimationFrame(() => this._renderNextBatch());
                }
            }
        }, {
            root: this.container,
            rootMargin: '200px', 
            threshold: 0.1
        });

        this.observer.observe(this.sentinel);
        this._renderNextBatch();
    }

    _renderNextBatch() {
        if (this.renderedCount >= this.items.length) {
            if (this.sentinel) this.sentinel.remove();
            if (this.observer) this.observer.disconnect();
            this.isRendering = false;
            return;
        }

        const batch = this.items.slice(this.renderedCount, this.renderedCount + BATCH_SIZE);
        const fragment = document.createDocumentFragment();
        
        let currentSection = null;
        
        if (this.sentinel && this.sentinel.previousElementSibling && 
            this.sentinel.previousElementSibling.classList.contains('section')) {
            currentSection = this.sentinel.previousElementSibling;
        }

        batch.forEach((item, batchIndex) => {
            const globalIndex = this.renderedCount + batchIndex;
            let prefix = 'misc';
            if (['title', 'subtitle', 'nidana'].includes(item.label)) {
                prefix = 'intro';
            } else if (item.label === 'end') {
                prefix = 'outro';
            } else if (item.label.startsWith('note')) {
                prefix = this.currentPrefix || 'intro'; 
            } else {
                const match = item.label.match(/^([a-z]+)/);
                if (match) {
                    prefix = match[1];
                }
            }
            
            const isSectionStart = 
                (prefix !== this.currentPrefix) || 
                (item.label.endsWith('-chapter')) ||
                (item.label === 'title');

            if (isSectionStart || !currentSection) {
                this.currentPrefix = prefix;
                currentSection = document.createElement('section');
                currentSection.className = `section section-${prefix}`;
                currentSection.id = `section-${item.label}`;
                fragment.appendChild(currentSection);
            }

            const segmentEl = this.segmentFactory.create(item, globalIndex);
            this.elementCache.set(item.id, segmentEl);
            currentSection.appendChild(segmentEl);
        });

        if (this.sentinel && this.sentinel.parentNode === this.container) {
            this.container.insertBefore(fragment, this.sentinel);
        } else {
            this.container.appendChild(fragment);
        }
        
        this.renderedCount += batch.length;
        this.isRendering = false;

        if (this.renderedCount >= this.items.length) {
            if (this.sentinel) this.sentinel.remove();
            if (this.observer) this.observer.disconnect();
        }
    }

    _ensureRendered(targetIndex) {
        if (targetIndex === -1 || targetIndex < this.renderedCount) return;
        while (this.renderedCount <= targetIndex) {
            this._renderNextBatch();
            if (this.renderedCount >= this.items.length) break;
        }
    }

    playSequenceFromIndex(startIndex) {
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
                if (itemLevel <= startLevel) break;
            }

            if (item.audio && item.audio !== 'skip') {
                sequence.push({ id: item.id, audio: item.audio, text: item.text });
            }
        }
        
        if (sequence.length > 0) {
            this.playSequenceCallback(sequence, startItem.id);
        } else {
            alert("Không có dữ liệu âm thanh cho phần này.");
        }
    }

    // --- Public API Facades ---

    scrollToSegment(id) {
        this.scrollManager.scrollToSegment(id);
    }

    highlightSegment(id, shouldScroll = true, scrollMode = 'smart') {
        this.scrollManager.highlightSegment(id, shouldScroll, scrollMode);
    }

    clearHighlight() {
        this.scrollManager.clearHighlight();
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

        const activeEl = this.elementCache.get(activeSegmentId);
        if (!activeEl) return;

        const segmentBtn = activeEl.querySelector('.play-btn:not(.play-sequence-btn)');
        if (segmentBtn) {
            segmentBtn.classList.add('active-play');
            segmentBtn.innerHTML = state === 'playing' ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
            segmentBtn.title = state === 'playing' ? "Tạm dừng" : "Tiếp tục";
        }

        if (isSequence && sequenceParentId) {
            const parentEl = this.elementCache.get(sequenceParentId);
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

