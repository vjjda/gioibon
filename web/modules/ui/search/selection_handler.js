// Path: web/modules/ui/search/selection_handler.js
export class SelectionHandler {
    constructor(searchRenderer) {
        this.searchRenderer = searchRenderer;
        this.tooltip = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        
        this.currentSelection = '';
        this.activeSegmentId = null;
        this._selectionTimer = null;
        this._isInteracting = false; 

        this._setupListeners();
        console.log("✅ SelectionHandler initialized with Half-Screen Flip logic.");
    }

    _setupListeners() {
        document.addEventListener('selectionchange', () => {
            this._handleSelectionUpdate();
        });

        const startInteracting = () => {
            this._isInteracting = true;
        };

        const endInteracting = () => {
            this._isInteracting = false;
            // Tăng delay lên 50ms để Safari ổn định Menu Native
            setTimeout(() => this._handleSelectionUpdate(true), 50);
        };

        document.addEventListener('mousedown', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                this._hideTooltip();
            }
            startInteracting();
        });
        document.addEventListener('mouseup', endInteracting);

        document.addEventListener('touchstart', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                this._hideTooltip();
            }
            startInteracting();
        }, { passive: true });
        document.addEventListener('touchend', endInteracting);

        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._performSearch();
            });
        }
    }

    _handleSelectionUpdate(forceShow = false) {
        const selection = window.getSelection();
        
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            this._hideTooltip();
            return;
        }

        const text = selection.toString().trim();
        
        if (text.length > 1 && text.length < 150) {
            this.currentSelection = text;
            
            if (forceShow || !this._isInteracting) {
                requestAnimationFrame(() => this._showTooltip(selection));
                this._highlightActiveSegment(selection);
            }
        } else {
            this._hideTooltip();
        }
    }

    _showTooltip(selection) {
        if (!this.tooltip || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        
        if (rect.width === 0 && rect.height === 0) {
            const rects = range.getClientRects();
            if (rects.length > 0) {
                rect = rects[0];
            } else {
                return;
            }
        }

        // --- CHIẾN THUẬT NỬA MÀN HÌNH (iOS/Android Optimization) ---
        const viewportHeight = window.innerHeight;
        const middleLine = viewportHeight / 2;
        
        // Mặc định cho Android là hiện ở dưới. 
        // Cho iOS/Desktop: Nếu vùng chọn nằm ở nửa trên (rect.top < middleLine) -> Hiện ở DƯỚI.
        const isAndroid = /Android/i.test(navigator.userAgent);
        let showAtBottom = isAndroid || (rect.top < middleLine);

        // Tọa độ tuyệt đối so với body (body không cuộn, nên scrollY thường là 0)
        const top = rect.top + window.scrollY;
        const bottom = rect.bottom + window.scrollY;
        const left = rect.left + window.scrollX + (rect.width / 2);

        this.tooltip.style.left = `${left}px`;

        if (showAtBottom) {
            this.tooltip.style.top = `${bottom}px`;
            this.tooltip.classList.add('at-bottom');
        } else {
            this.tooltip.style.top = `${top}px`;
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
        if (selection.rangeCount === 0) return;
        
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
