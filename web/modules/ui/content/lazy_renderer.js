// Path: web/modules/ui/content/lazy_renderer.js
const BATCH_SIZE = 60;

export class LazyRenderer {
    constructor(container, elementCache, segmentFactory) {
        this.container = container;
        this.elementCache = elementCache;
        this.segmentFactory = segmentFactory;

        this.items = [];
        this.renderedCount = 0;
        this.observer = null;
        this.sentinel = null;
        this.currentPrefix = null;
        this.isRendering = false;
    }

    render(items) {
        if (!this.container) return;
        
        this._cleanup();
        this.items = items || [];
        
        if (this.items.length === 0) {
            this.container.innerHTML = '<div class="empty">Không có dữ liệu hiển thị.</div>';
            return;
        }

        this.sentinel = document.createElement('div');
        this.sentinel.className = 'loading-sentinel';
        this.sentinel.style.height = '50px';
        this.sentinel.style.width = '100%';
        this.container.appendChild(this.sentinel);
        
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.isRendering) {
                this.isRendering = true;
                requestAnimationFrame(() => this.renderNextBatch());
            }
        }, { root: this.container, rootMargin: '200px', threshold: 0.1 });

        this.observer.observe(this.sentinel);
        this.renderNextBatch();
    }

    renderNextBatch() {
        if (this.renderedCount >= this.items.length) {
            this._removeSentinel();
            return;
        }

        const batch = this.items.slice(this.renderedCount, this.renderedCount + BATCH_SIZE);
        const fragment = document.createDocumentFragment();
        let currentSection = this._getCurrentSection();

        batch.forEach((item, batchIndex) => {
            const globalIndex = this.renderedCount + batchIndex;
            const prefix = this._getSectionPrefix(item);
            
            const isSectionStart = (prefix !== this.currentPrefix) || 
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

        this._appendFragment(fragment);
        
        this.renderedCount += batch.length;
        this.isRendering = false;

        if (this.renderedCount >= this.items.length) {
            this._removeSentinel();
        }
    }

    ensureRendered(targetIndex) {
        if (targetIndex === -1 || targetIndex < this.renderedCount) return;
        while (this.renderedCount <= targetIndex) {
            this.renderNextBatch();
            if (this.renderedCount >= this.items.length) break;
        }
    }

    _cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.container.innerHTML = '';
        this.elementCache.clear();
        this.renderedCount = 0;
        this.currentPrefix = null;
        this.sentinel = null;
        this.isRendering = false;
    }

    _removeSentinel() {
        if (this.sentinel) {
            this.sentinel.remove();
            this.sentinel = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isRendering = false;
    }

    _getCurrentSection() {
        if (this.sentinel && this.sentinel.previousElementSibling && 
            this.sentinel.previousElementSibling.classList.contains('section')) {
            return this.sentinel.previousElementSibling;
        }
        return null;
    }

    _appendFragment(fragment) {
        if (this.sentinel && this.sentinel.parentNode === this.container) {
            this.container.insertBefore(fragment, this.sentinel);
        } else {
            this.container.appendChild(fragment);
        }
    }

    _getSectionPrefix(item) {
        if (['title', 'subtitle', 'nidana'].includes(item.label)) return 'intro';
        if (item.label === 'end') return 'outro';
        if (item.label.startsWith('note')) return this.currentPrefix || 'intro'; 
        const match = item.label.match(/^([a-z]+)/);
        if (match) return match[1];
        return 'misc';
    }
}

