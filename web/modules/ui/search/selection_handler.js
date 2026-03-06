// Path: web/modules/ui/search/selection_handler.js
export class SelectionHandler {
    constructor(searchRenderer, highlightManager) {
        this.searchRenderer = searchRenderer;
        this.highlightManager = highlightManager;
        this.tooltip = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        this.colorBtns = this.tooltip ? this.tooltip.querySelectorAll('.color-btn') : [];
        
        this.currentSelection = '';
        this.activeSegmentId = null;
        this._selectionTimer = null;
        this._isInteracting = false; 

        this._setupListeners();
        console.log("✅ SelectionHandler initialized with robust touch/mouse sync and click-to-select.");
    }

    _setupListeners() {
        const startInteracting = (e) => {
            // Nếu bấm vào chính tooltip hoặc nút Tra cứu thì bỏ qua (không ẩn)
            if (this.tooltip && (this.tooltip.contains(e.target) || this.btnSearch.contains(e.target))) {
                return;
            }
            this._isInteracting = true;
            this._hideTooltip();
        };

        const endInteracting = (e) => {
            if (this._isInteracting) {
                this._isInteracting = false;
                // Nhấc tay/chuột ra thì hiện Tooltip cực nhanh
                this._debouncedShowTooltip(50);
            }
        };

        document.addEventListener('selectionchange', () => {
            if (this._isInteracting) {
                // Đang giữ chuột/tay vuốt chọn văn bản -> ẩn tooltip
                this._hideTooltip();
            } else {
                // Người dùng đang kéo các "cục handle" (Native Selection) của Android/iOS
                // Hoặc đang dùng phím Shift + Mũi tên.
                // Ẩn tooltip và đợi khi nào dừng kéo (khoảng 400ms) thì mới hiện.
                this._hideTooltip();
                this._debouncedShowTooltip(400); 
            }
        });

        document.addEventListener('mousedown', startInteracting);
        document.addEventListener('mouseup', endInteracting);
        document.addEventListener('touchstart', startInteracting, { passive: true });
        document.addEventListener('touchend', endInteracting);
        // QUAN TRỌNG: Android khi Long Press (nhấn giữ để bôi đen) sẽ bắn touchcancel thay vì touchend!
        document.addEventListener('touchcancel', endInteracting);

        // [NEW] Bắt sự kiện Click lên thẻ Highlight bằng Capture mode để ưu tiên xử lý trước
        document.addEventListener('click', (e) => {
            const highlightEl = e.target.closest('.user-highlight');
            if (highlightEl) {
                // Ngăn chặn sự kiện click lan xuống (ví dụ click vào Heading làm thu gọn nội dung)
                e.stopPropagation();
                e.preventDefault();

                const highlightId = highlightEl.dataset.highlightId;
                const segmentEl = highlightEl.closest('.segment');
                if (highlightId && segmentEl) {
                    this._selectHighlight(segmentEl, highlightId);
                }
            }
        }, true); // Sử dụng true (capture) để đón đầu sự kiện

        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._performSearch();
            });
        }

        if (this.colorBtns) {
            this.colorBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this._applyHighlight(btn.dataset.color);
                });
            });
        }
    }

    // [NEW] Hàm tái tạo vùng chọn bằng code
    _selectHighlight(segmentEl, highlightId) {
        // Lấy tất cả các thẻ có cùng chung mã bôi đen (các chunk liên tiếp)
        const spans = Array.from(segmentEl.querySelectorAll(`.user-highlight[data-highlight-id="${highlightId}"]`));
        if (spans.length === 0) return;

        const firstSpan = spans[0];
        const lastSpan = spans[spans.length - 1];

        const selection = window.getSelection();
        selection.removeAllRanges();

        const range = document.createRange();
        
        // Luôn trỏ vào TextNode bên trong để chọn chính xác ký tự
        const startNode = firstSpan.firstChild || firstSpan;
        const endNode = lastSpan.firstChild || lastSpan;

        try {
            range.setStart(startNode, 0);
            range.setEnd(endNode, endNode.nodeValue ? endNode.nodeValue.length : 0);
            selection.addRange(range);

            this.activeSegmentId = segmentEl.dataset.id;
            this.currentSelection = selection.toString().trim();
            
            // Ép xuất hiện Tooltip ngay lập tức
            this._showTooltip(selection);
        } catch (e) {
            console.error("Could not select highlight programmatically", e);
        }
    }

    _applyHighlight(color) {
        if (!this.activeSegmentId || !this.highlightManager) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const segmentEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
        if (!segmentEl) return;

        const offsets = this.highlightManager.constructor.getSelectionOffsets(selection, segmentEl);
        if (offsets.start === offsets.end) return;

        // [UPDATED] Luôn xóa các highlight bị chồng lấn trước khi áp dụng màu mới
        this.highlightManager.removeHighlightsInRange(this.activeSegmentId, offsets.start, offsets.end);

        if (color !== 'clear') {
            this.highlightManager.addHighlight(
                this.activeSegmentId, 
                offsets.start, 
                offsets.end, 
                color, 
                this.currentSelection
            );
        }

        // Bắt buộc gọi refresh lại DOM để hiện hoặc ẩn màu lập tức
        this._refreshSegmentDOM(this.activeSegmentId);
        this._hideTooltip();
        window.getSelection().removeAllRanges();
    }

    _refreshSegmentDOM(segmentId) {
        // Find segment and re-render its text or re-apply highlights
        const segmentEl = document.querySelector(`.segment[data-id="${segmentId}"]`);
        if (segmentEl && this.searchRenderer.contentRenderer) {
            if (this.searchRenderer.contentRenderer.refreshSegment) {
                this.searchRenderer.contentRenderer.refreshSegment(segmentId);
            }
        }
    }

    _debouncedShowTooltip(delay) {
        if (this._selectionTimer) {
            clearTimeout(this._selectionTimer);
        }
        this._selectionTimer = setTimeout(() => {
            this._handleSelectionUpdate();
        }, delay);
    }

    _handleSelectionUpdate() {
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

        // --- CHIẾN THUẬT ĐỊNH VỊ THEO YÊU CẦU CỦA USER ---
        const isAndroid = /Android/i.test(navigator.userAgent);
        // Nhận diện iOS (iPhone, iPad, iPod) kể cả iPadOS dùng MacIntel
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        const viewportHeight = window.innerHeight;

        // MẶC ĐỊNH CHUNG: Hiện ở DƯỚI (Dành cho Desktop và Android)
        let showAtBottom = true;

        if (isIOS) {
            // RIÊNG iOS: Mặc định Tooltip hiện ở TRÊN.
            showAtBottom = false;

            if (rect.top > viewportHeight * 0.48) {
                showAtBottom = true;
            }
        }

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