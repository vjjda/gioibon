// Path: web/modules/ui/search/selection_handler.js
export class SelectionHandler {
    constructor(searchRenderer) {
        this.searchRenderer = searchRenderer;
        this.tooltip = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        
        this.currentSelection = '';
        this.activeSegmentId = null;
        this._selectionTimer = null;

        this._setupListeners();
        console.log("✅ SelectionHandler initialized.");
    }

    _setupListeners() {
        // Safari (Mac/iOS) sometimes behaves better with mouseup/touchend than selectionchange alone
        document.addEventListener('selectionchange', () => this._debouncedHandleSelection());
        document.addEventListener('mouseup', () => this._debouncedHandleSelection());
        document.addEventListener('touchend', () => this._debouncedHandleSelection());

        document.addEventListener('mousedown', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                this._hideTooltip();
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

    _debouncedHandleSelection() {
        if (this._selectionTimer) {
            clearTimeout(this._selectionTimer);
        }
        this._selectionTimer = setTimeout(() => {
            this._handleSelection();
        }, 50); // Small delay to let the selection stabilize
    }

    _handleSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            this._hideTooltip();
            return;
        }

        const text = selection.toString().trim();
        if (text.length > 1 && text.length < 150) {
            this.currentSelection = text;
            requestAnimationFrame(() => this._showTooltip(selection));
            this._highlightActiveSegment(selection);
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

        const viewportHeight = window.innerHeight;
        const tooltipHeight = 50; // Estimated height including margin
        const safeZoneTop = 60;   // Space for browser bars
        
        // Logic định vị thông minh:
        // 1. Mặc định hiện ở trên (giống iOS native menu).
        // 2. Nếu khoảng cách từ đỉnh vùng chọn tới mép trên màn hình < 60px (bị che bởi thanh địa chỉ/header)
        //    -> Đẩy xuống dưới.
        // 3. Nếu đang ở Android, ưu tiên hiện ở dưới vì Menu native Android thường ở trên cùng.
        
        const isAndroid = /Android/i.test(navigator.userAgent);
        let showAtBottom = isAndroid;

        if (!isAndroid) {
            // Trên iOS/Desktop, nếu không đủ chỗ ở trên thì hiện ở dưới
            if (rect.top < (tooltipHeight + safeZoneTop)) {
                showAtBottom = true;
            }
        }

        // Tính toán tọa độ tuyệt đối so với tài liệu
        const top = rect.top + window.scrollY;
        const bottom = rect.bottom + window.scrollY;
        const left = rect.left + window.scrollX + (rect.width / 2);

        if (showAtBottom) {
            this.tooltip.style.top = `${bottom}px`;
            this.tooltip.classList.add('at-bottom');
        } else {
            this.tooltip.style.top = `${top}px`;
            this.tooltip.classList.remove('at-bottom');
        }
        
        this.tooltip.style.left = `${left}px`;
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