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
        this.activeHighlightId = null; // Dùng để theo dõi nếu người dùng click vào highlight có sẵn
        this._selectionTimer = null;
        this._isInteracting = false; 

        this._setupListeners();
        console.log("✅ SelectionHandler initialized with seamless click-to-edit without native selection.");
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
                // [FIXED] Không ẩn tooltip ngay lập tức nếu đang thao tác click trên Highlight có sẵn
                if (!this.activeHighlightId) {
                    this._hideTooltip();
                }
                
                // Vẫn gọi hàm kiểm tra trễ để xem người dùng có đang bôi đen text mới không
                this._debouncedShowTooltip(400); 
            }
        });

        document.addEventListener('mousedown', startInteracting);
        document.addEventListener('mouseup', endInteracting);
        document.addEventListener('touchstart', startInteracting, { passive: true });
        document.addEventListener('touchend', endInteracting);
        // QUAN TRỌNG: Android khi Long Press (nhấn giữ để bôi đen) sẽ bắn touchcancel thay vì touchend!
        document.addEventListener('touchcancel', endInteracting);

        // Bắt sự kiện Click lên thẻ Highlight bằng Capture mode
        document.addEventListener('click', (e) => {
            const highlightEl = e.target.closest('.user-highlight');
            if (highlightEl) {
                e.stopPropagation();
                e.preventDefault();

                const highlightId = highlightEl.dataset.highlightId;
                const segmentEl = highlightEl.closest('.segment');
                if (highlightId && segmentEl) {
                    this._handleHighlightClick(segmentEl, highlightId);
                }
            }
        }, true);

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

    // Hàm xử lý click highlight KHÔNG bôi đen native
    _handleHighlightClick(segmentEl, highlightId) {
        // Lấy tất cả các thẻ có cùng chung mã bôi đen (các chunk liên tiếp)
        const spans = Array.from(segmentEl.querySelectorAll(`.user-highlight[data-highlight-id="${highlightId}"]`));
        if (spans.length === 0) return;

        this.activeSegmentId = segmentEl.dataset.id;
        this.activeHighlightId = highlightId; // Đánh dấu là đang thao tác trên highlight cũ
        
        // Nối text từ các mảnh lại để phục vụ tìm kiếm
        this.currentSelection = spans.map(s => s.textContent).join('');

        // TẠO RANGE ẢO CHỈ ĐỂ LẤY TỌA ĐỘ (Giữ nguyên vị trí hiển thị tooltip)
        const range = document.createRange();
        range.setStartBefore(spans[0]);
        range.setEndAfter(spans[spans.length - 1]);
        const rect = range.getBoundingClientRect();

        // Ép xóa bỏ bôi đen native (nếu có vô tình dính)
        window.getSelection().removeAllRanges();

        // Hiển thị Tooltip dựa trên tọa độ Range ảo
        this._showTooltipAtRect(rect);
    }

    _applyHighlight(color) {
        if (!this.activeSegmentId || !this.highlightManager) return;

        // KỊCH BẢN 1: Người dùng đang CHỈNH SỬA một highlight có sẵn
        if (this.activeHighlightId) {
            const existingHighlights = this.highlightManager.getHighlights(this.activeSegmentId);
            const targetHighlight = existingHighlights.find(h => h.id === this.activeHighlightId);

            if (targetHighlight) {
                // Xóa màu cũ đi trước
                this.highlightManager.removeHighlight(this.activeSegmentId, this.activeHighlightId);
                
                // Nếu không phải thao tác "Tẩy", thì áp màu mới đúng vào tọa độ đó
                if (color !== 'clear') {
                    this.highlightManager.addHighlight(
                        this.activeSegmentId,
                        targetHighlight.start,
                        targetHighlight.end,
                        color,
                        targetHighlight.text
                    );
                }
            }
        } 
        // KỊCH BẢN 2: Người dùng TẠO MỚI một highlight từ vùng bôi đen Native
        else {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const segmentEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
            if (!segmentEl) return;

            const offsets = this.highlightManager.constructor.getSelectionOffsets(selection, segmentEl);
            if (offsets.start === offsets.end) return;

            // Xóa rác bị chồng lấn trước khi vẽ
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
            window.getSelection().removeAllRanges();
        }

        // Bắt buộc gọi refresh lại DOM để hiện hoặc ẩn màu lập tức
        this._refreshSegmentDOM(this.activeSegmentId);
        this._hideTooltip();
    }

    _refreshSegmentDOM(segmentId) {
        const segmentEl = document.querySelector(`.segment[data-id="${segmentId}"]`);
        if (segmentEl && this.searchRenderer.contentRenderer && this.searchRenderer.contentRenderer.refreshSegment) {
            this.searchRenderer.contentRenderer.refreshSegment(segmentId);
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
            // Chỉ ẩn tooltip nếu không phải đang click vào một highlight có sẵn
            if (!this.activeHighlightId) {
                this._hideTooltip();
            }
            return;
        }

        const text = selection.toString().trim();
        if (text.length > 1 && text.length < 150) {
            this.activeHighlightId = null; // Reset trạng thái click highlight cũ vì user đã bôi đen mới
            this.currentSelection = text;
            
            const range = selection.getRangeAt(0);
            let rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                const rects = range.getClientRects();
                if (rects.length > 0) rect = rects[0];
                else return;
            }

            requestAnimationFrame(() => this._showTooltipAtRect(rect));
            this._highlightActiveSegment(selection);
        } else {
            if (!this.activeHighlightId) {
                this._hideTooltip();
            }
        }
    }

    // Tách logic hiển thị theo tọa độ Rect ra hàm riêng
    _showTooltipAtRect(rect) {
        if (!this.tooltip || !rect) return;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        const viewportHeight = window.innerHeight;
        let showAtBottom = true;

        if (isIOS) {
            showAtBottom = false;
            if (rect.top > viewportHeight * 0.48) {
                showAtBottom = true;
            }
        }

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
        this.activeHighlightId = null; // Reset lại mỗi khi ẩn
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