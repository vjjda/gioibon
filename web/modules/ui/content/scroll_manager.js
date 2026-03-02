// Path: web/modules/ui/content/scroll_manager.js
import { UI_CONFIG } from 'core/config.js';

export class ScrollManager {
    constructor(container, elementCache, getItemsCallback, ensureRenderedCallback) {
        this.container = container;
        this.elementCache = elementCache;
        this.getItems = getItemsCallback;
        this.ensureRendered = ensureRenderedCallback;
        this.activeSegmentId = null;
        this.scrollTimeout = null;
        this.isTransitioning = false; // Flag khóa lưu vị trí khi đang nhảy trang

        // Bắt sự kiện cuộn để lưu vị trí
        if (this.container) {
            this.container.addEventListener('scroll', () => this._handleScroll(), { passive: true });
        }
    }

    _handleScroll() {
        if (this.isTransitioning) return; // Không lưu vị trí khi đang chuyển mode
        
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this._saveScrollPosition();
        }, 300); // Debounce 300ms
    }

    _saveScrollPosition() {
        if (!this.container || this.isTransitioning) return;
        const segments = this.container.querySelectorAll('.segment');
        for (const segment of segments) {
            const rect = segment.getBoundingClientRect();
            // Ưu tiên đoạn văn bản ngay sát dưới header (70px)
            if (rect.top >= 65 && rect.top < 150) {
                const id = parseInt(segment.dataset.id);
                if (id) {
                    localStorage.setItem('sutta_last_segment_id', id.toString());
                    break;
                }
            }
        }
    }

    restoreScrollPosition() {
        const lastId = localStorage.getItem('sutta_last_segment_id');
        if (lastId) {
            this.scrollToId(parseInt(lastId, 10), 'auto');
        }
    }

    scrollToId(id, behavior = 'auto') {
        if (!id || isNaN(id)) return;
        
        let targetEl = this.elementCache.get(id);
        
        // Kiểm tra phần tử có bị ẩn không (do Outline mode)
        const isHidden = (el) => !el || el.offsetParent === null;

        if (!targetEl || isHidden(targetEl)) {
            // Tìm tiêu đề (Heading) gần nhất phía trên nó
            const items = this.getItems();
            const index = items.findIndex(item => item.id === id);
            if (index !== -1) {
                for (let i = index; i >= 0; i--) {
                    const item = items[i];
                    const isHeading = item.html && item.html.match(/^<h[1-6]/i);
                    const isRule = item.label && item.label.endsWith('-name');
                    
                    if (isHeading || isRule || item.label === 'title') {
                        this.ensureRendered(i);
                        targetEl = this.elementCache.get(item.id);
                        if (targetEl && !isHidden(targetEl)) break;
                    }
                }
            }
        }

        if (targetEl) {
            this._scrollToTop(targetEl, behavior);
        }
    }

    scrollToSegment(id) {
        this.highlightSegment(id, true, 'top');
    }

    highlightSegment(id, shouldScroll = true, scrollMode = 'smart') {
        if (!this.container) return;
        
        let activeEl = this.elementCache.get(id);
        if (!activeEl) {
             const items = this.getItems();
             const index = items.findIndex(item => item.id === id);
             if (index !== -1) {
                 this.ensureRendered(index);
                 activeEl = this.elementCache.get(id);
             }
        }

        if (this.activeSegmentId !== null && this.activeSegmentId !== id) {
            const prevEl = this.elementCache.get(this.activeSegmentId);
            if (prevEl) prevEl.classList.remove('active');
        }

        if (activeEl) {
            activeEl.classList.add('active');
            this.activeSegmentId = id;

            if (shouldScroll) {
                if (scrollMode === 'top') {
                    this._scrollToTop(activeEl);
                } else {
                    this._smartScroll(activeEl);
                }
            }
        }
    }

    clearHighlight() {
        if (this.activeSegmentId !== null) {
            const prevEl = this.elementCache.get(this.activeSegmentId);
            if (prevEl) prevEl.classList.remove('active');
            this.activeSegmentId = null;
        }
    }

    _scrollToTop(el, behavior = 'auto') {
        if (!this.container || !el) return;
        
        const rect = el.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        const offset = 20; 
        const targetScrollTop = this.container.scrollTop + (rect.top - containerRect.top) - offset;

        this.container.scrollTo({
            top: targetScrollTop,
            behavior: behavior
        });
    }

    _parseThreshold(val) {
        if (typeof val === 'number') return val;
        
        if (typeof val !== 'string') return 0;
        if (val.endsWith('vh')) {
            return (parseFloat(val) / 100) * document.documentElement.clientHeight;
        }
        return parseFloat(val) || 0;
    }

    _smartScroll(el) {
        if (!this.container || !el) return;
        
        const rect = el.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        const thresholdTop = this._parseThreshold(UI_CONFIG.SCROLL_THRESHOLD_TOP);
        const thresholdBottom = this._parseThreshold(UI_CONFIG.SCROLL_THRESHOLD_BOTTOM);

        const sightTop = containerRect.top + thresholdTop;
        const sightBottom = containerRect.bottom - thresholdBottom;
        
        const isOutOfSightTop = rect.top < sightTop;
        const isOutOfSightBottom = rect.bottom > sightBottom;

        if (isOutOfSightTop || isOutOfSightBottom) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const behavior = isMobile ? 'auto' : UI_CONFIG.SCROLL_BEHAVIOR;
            
            const targetScrollTop = this.container.scrollTop + (rect.top - sightTop);
            
            this.container.scrollTo({
                top: targetScrollTop,
                behavior: behavior
            });
        }
    }
}

