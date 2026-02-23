// Path: web/modules/ui/content/scroll_manager.js
import { UI_CONFIG } from 'core/config.js';

export class ScrollManager {
    constructor(container, elementCache, getItemsCallback, ensureRenderedCallback) {
        this.container = container;
        this.elementCache = elementCache;
        this.getItems = getItemsCallback;
        this.ensureRendered = ensureRenderedCallback;
        this.activeSegmentId = null;
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

    _scrollToTop(el) {
        if (!this.container || !el) return;
        
        const rect = el.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        const offset = 20; 
        const targetScrollTop = this.container.scrollTop + (rect.top - containerRect.top) - offset;

        this.container.scrollTo({
            top: targetScrollTop,
            behavior: 'auto'
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

