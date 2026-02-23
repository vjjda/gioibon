// Path: web/modules/ui/content_renderer.js
import { SegmentFactory } from 'ui/content/segment_factory.js';
import { MaskManager } from 'ui/content/mask_manager.js';
import { UI_CONFIG } from 'core/config.js';

const BATCH_SIZE = 60;

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        this.items = [];
        this.hoveredSegmentId = null;
        
        // Cache DOM elements for O(1) access
        this.elementCache = new Map();
        this.activeSegmentId = null;

        this.maskManager = new MaskManager(this.container);
        this.segmentFactory = new SegmentFactory({
            playSegment: this.playSegmentCallback,
            playSequence: (index) => this._handlePlaySequence(index),
            onMaskStart: (e, el, item) => this.maskManager.handleMaskStart(e, el, item),
            onMaskEnter: (e, el) => this.maskManager.handleMaskEnter(e, el),
            onHover: (id) => { this.hoveredSegmentId = id; }
        });

        // Lazy Loading State
        this.renderedCount = 0;
        this.observer = null;
        this.sentinel = null;
        this.currentPrefix = null; 
        this.isRendering = false; // Throttle flag

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
        
        // Cleanup previous state
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.container.innerHTML = '';
        this.elementCache.clear();
        this.activeSegmentId = null;
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

        // Create Sentinel for Infinite Scroll
        this.sentinel = document.createElement('div');
        this.sentinel.className = 'loading-sentinel';
        this.sentinel.style.height = '50px';
        this.sentinel.style.width = '100%';
        this.container.appendChild(this.sentinel);
        
        // Setup Observer
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Throttle rendering to next animation frame to prevent loops
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

        // Initial Batch
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
        
        // Find or create current section
        let currentSection = null;
        
        // Check strictly if the last element BEFORE sentinel is a section
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

        // Insert before sentinel
        if (this.sentinel && this.sentinel.parentNode === this.container) {
            this.container.insertBefore(fragment, this.sentinel);
        } else {
            // Fallback if sentinel missing
            this.container.appendChild(fragment);
        }
        
        this.renderedCount += batch.length;
        this.isRendering = false;

        // If we rendered everything, cleanup
        if (this.renderedCount >= this.items.length) {
            if (this.sentinel) this.sentinel.remove();
            if (this.observer) this.observer.disconnect();
        }
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
                sequence.push({ id: item.id, audio: item.audio, text: item.text });
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
                this.playSegmentCallback(item.id, item.audio, item.text);
            }
        }
    }

    _handleKeyboardFlip() {
        if (!this.hoveredSegmentId) return;
        
        const item = this.items.find(i => i.id === this.hoveredSegmentId);
        if (!item) return;
        
        // Use cached element for flip as well
        const segmentEl = this.elementCache.get(this.hoveredSegmentId);
        
        if (segmentEl) {
            const hasAudio = item.audio && item.audio !== 'skip';
            const isHeading = item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
            
            if (hasAudio || isHeading) {
                this.maskManager.toggleMask(segmentEl, item);
            }
        }
    }

    _ensureRendered(targetIndex) {
        if (targetIndex === -1 || targetIndex < this.renderedCount) return;
        
        // Force render batches synchronously until we cover this index
        while (this.renderedCount <= targetIndex) {
            this._renderNextBatch();
            if (this.renderedCount >= this.items.length) break;
        }
    }

    scrollToSegment(id) {
        // Sử dụng mode 'top' để cuộn lên sát mép thay vì dùng Sight View của Audio
        this.highlightSegment(id, true, 'top');
    }

    highlightSegment(id, shouldScroll = true, scrollMode = 'smart') {
        if (!this.container) return;
        
        // Check if item is rendered. If not, force render.
        let activeEl = this.elementCache.get(id);
        if (!activeEl) {
             const index = this.items.findIndex(item => item.id === id);
             if (index !== -1) {
                 this._ensureRendered(index);
                 activeEl = this.elementCache.get(id);
             }
        }

        // 1. Remove previous active class efficiently
        if (this.activeSegmentId !== null && this.activeSegmentId !== id) {
            const prevEl = this.elementCache.get(this.activeSegmentId);
            if (prevEl) prevEl.classList.remove('active');
        }

        // 2. Add new active class
        if (activeEl) {
            activeEl.classList.add('active');
            this.activeSegmentId = id;

            // 3. Điều hướng cuộn tùy theo Mode
            if (shouldScroll) {
                if (scrollMode === 'top') {
                    this._scrollToTop(activeEl);
                } else {
                    this._smartScroll(activeEl);
                }
            }
        }
    }

    _scrollToTop(el) {
        if (!this.container || !el) return;
        
        const rect = el.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        // Khoảng đệm nhỏ (offset) để thẻ HTML cách đỉnh một chút cho dễ nhìn
        const offset = 20; 
        const targetScrollTop = this.container.scrollTop + (rect.top - containerRect.top) - offset;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const behavior = isMobile ? 'auto' : UI_CONFIG.SCROLL_BEHAVIOR;

        this.container.scrollTo({
            top: targetScrollTop,
            behavior: behavior
        });
    }

    _parseThreshold(val) {
        if (typeof val === 'number') return val;
        
        if (typeof val !== 'string') return 0;
        if (val.endsWith('vh')) {
            // Dùng clientHeight của root để tính % vh chuẩn
            return (parseFloat(val) / 100) * document.documentElement.clientHeight;
        }
        return parseFloat(val) || 0;
    }

    _smartScroll(el) {
        if (!this.container || !el) return;
        
        // 1. Lấy thông số thực tế tại thời điểm gọi (để chống lỗi Safari Address Bar)
        const rect = el.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        // 2. Lấy ngưỡng cấu hình
        const thresholdTop = this._parseThreshold(UI_CONFIG.SCROLL_THRESHOLD_TOP);
        const thresholdBottom = this._parseThreshold(UI_CONFIG.SCROLL_THRESHOLD_BOTTOM);

        // 3. Xác định vùng Sight View (tọa độ so với Viewport)
        // sightTop: điểm bắt đầu vùng nhìn (ngay dưới Header + khoảng đệm)
        const sightTop = containerRect.top + thresholdTop;
        
        // sightBottom: điểm kết thúc vùng nhìn (trên Global Controls + khoảng đệm)
        const sightBottom = containerRect.bottom - thresholdBottom;
        
        // 4. Kiểm tra xem Segment có nằm ngoài vùng Sight View không
        const isOutOfSightTop = rect.top < sightTop;
        const isOutOfSightBottom = rect.bottom > sightBottom;

        if (isOutOfSightTop || isOutOfSightBottom) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            // Safari iOS hoạt động ổn định nhất với 'auto' khi xử lý audio liên tục
            const behavior = isMobile ? 'auto' : UI_CONFIG.SCROLL_BEHAVIOR;
            
            // 5. Tính toán vị trí cuộn Tuyệt đối
            // Target: Đưa mép trên của segment về đúng vị trí sightTop
            // Công thức: scrollTop hiện tại + (khoảng cách hiện tại của segment tới sightTop)
            const targetScrollTop = this.container.scrollTop + (rect.top - sightTop);
            
            this.container.scrollTo({
                top: targetScrollTop,
                behavior: behavior
            });
        }
    }

    clearHighlight() {
        if (this.activeSegmentId !== null) {
            const prevEl = this.elementCache.get(this.activeSegmentId);
            if (prevEl) prevEl.classList.remove('active');
            this.activeSegmentId = null;
        }
    }

    updatePlaybackState(state, activeSegmentId, isSequence, sequenceParentId) {
        // Reset global buttons (could be optimized further but less critical)
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

        // Efficient lookup using cache
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
        
        // Optimization: Only check rendered segments? 
        // QuerySelectorAll gets ALL rendered segments, which is fine since we lazy load.
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

