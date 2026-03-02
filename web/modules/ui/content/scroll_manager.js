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

    /**
     * Tìm mỏ neo (heading) để giữ vị trí cố định khi co giãn nội dung
     */
    getVisibleAnchor() {
        if (!this.container) return null;
        const segments = Array.from(this.container.querySelectorAll('.segment'));
        
        // Danh sách các tiêu đề có khả năng hiển thị trong cả 2 mode
        const isHeadingEl = (el) => 
            el.classList.contains('heading-segment') || 
            el.classList.contains('chapter-header') || 
            el.classList.contains('rule-header') ||
            el.classList.contains('main-title');

        const headings = segments.filter(isHeadingEl);

        // 1. Tìm tiêu đề đầu tiên đang nằm trong khung nhìn
        for (const el of headings) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > 70 && rect.top < window.innerHeight) {
                return { id: el.dataset.id, top: rect.top };
            }
        }

        // 2. Nếu không thấy tiêu đề nào, lấy tiêu đề gần nhất ở phía trên (đã cuộn qua)
        for (let i = headings.length - 1; i >= 0; i--) {
            const el = headings[i];
            const rect = el.getBoundingClientRect();
            if (rect.top <= 70) {
                return { id: el.dataset.id, top: rect.top };
            }
        }

        // 3. Cùng bất đắc dĩ: lấy segment bất kỳ đang hiện
        for (const el of segments) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > 70) {
                return { id: el.dataset.id, top: rect.top };
            }
        }
        
        return null;
    }

    /**
     * Cuộn sao cho phần tử neo nằm đúng vị trí pixel cũ
     */
    scrollToAnchor(anchor) {
        if (!anchor || !anchor.id) return;
        const id = parseInt(anchor.id, 10);
        
        let targetEl = this.elementCache.get(id);
        if (!targetEl) {
            const items = this.getItems();
            const index = items.findIndex(item => item.id === id);
            if (index !== -1) {
                this.ensureRendered(index);
                targetEl = this.elementCache.get(id);
            }
        }

        if (targetEl) {
            const currentRect = targetEl.getBoundingClientRect();
            const delta = currentRect.top - anchor.top;
            this.container.scrollTop += delta;
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

