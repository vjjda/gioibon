// Path: web/modules/ui/search/selection_handler.js
export class SelectionHandler {
    constructor(searchRenderer) {
        this.searchRenderer = searchRenderer;
        this.tooltip = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        
        this.currentSelection = '';
        this.activeSegmentId = null;

        this._setupListeners();
    }

    _setupListeners() {
        document.addEventListener('selectionchange', () => this._handleSelection());

        document.addEventListener('mousedown', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                this._hideTooltip();
            }
        });

        document.addEventListener('touchstart', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection || selection.isCollapsed) {
                        this._hideTooltip();
                    }
                }, 10);
            }
        });

        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._performSearch();
            });
        }
    }

    _handleSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            this._hideTooltip();
            return;
        }

        const text = selection.toString().trim();
        if (text.length > 1 && text.length < 150) {
            this.currentSelection = text;
            this._showTooltip(selection);
            this._highlightActiveSegment(selection);
        } else {
            this._hideTooltip();
        }
    }

    _showTooltip(selection) {
        if (!this.tooltip) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            const top = rect.bottom + window.scrollY;
            const left = rect.left + window.scrollX + (rect.width / 2);
            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.left = `${left}px`;
            this.tooltip.classList.add('at-bottom');
        } else {
            const top = rect.top + window.scrollY;
            const left = rect.left + window.scrollX + (rect.width / 2);
            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.left = `${left}px`;
            this.tooltip.classList.remove('at-bottom');
        }
        
        this.tooltip.classList.remove('hidden');
    }

    _hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.add('hidden');
        }
    }

    _highlightActiveSegment(selection) {
        let node = selection.anchorNode;
        let segmentEl = null;

        while (node && node !== document.body) {
            if (node.nodeType === 1 && node.classList.contains('segment')) {
                segmentEl = node;
                break;
            }
            node = node.parentNode;
        }

        if (segmentEl) {
            const segmentId = segmentEl.dataset.id;
            if (this.activeSegmentId && this.activeSegmentId !== segmentId) {
                const prevEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
                if (prevEl) prevEl.classList.remove('active-search-highlight');
            }

            this.activeSegmentId = segmentId;
            const textEl = segmentEl.querySelector('.segment-text');
            if (textEl) {
                textEl.classList.add('active-search-highlight');
            }
        }
    }

    _performSearch() {
        this._hideTooltip();
        this.searchRenderer.performSearch(this.currentSelection, this.activeSegmentId);
    }
}

