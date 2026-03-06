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
        console.log("✅ SelectionHandler initialized with robust touch/mouse sync.");
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

        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._performSearch();
            });
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

        // --- CHIẾN THUẬT ĐỊNH VỊ CHÍNH XÁC ---
        const isAndroid = /Android/i.test(navigator.userAgent);
        // Nhận diện iOS (iPhone, iPad, iPod) kể cả iPadOS dùng MacIntel
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // MẶC ĐỊNH: Luôn hiện Tooltip ở DƯỚI vùng chọn.
        // - Desktop: Không có menu hệ thống -> Ở dưới là lý tưởng, không che chữ đang đọc.
        // - Android: Menu hệ thống luôn ở TRÊN đỉnh màn hình -> Tooltip ở DƯỚI là an toàn tuyệt đối.
        // - iOS: Menu hệ thống mặc định ở TRÊN vùng chọn -> Tooltip ở DƯỚI là né được hoàn toàn.
        let showAtBottom = true; 

        if (isIOS) {
            // Hành vi đặc biệt của iOS: 
            // Khi vùng chọn nằm quá sát mép trên của màn hình, Menu hệ thống không còn chỗ ở trên
            // nên nó sẽ bắt buộc "lật" xuống DƯỚI vùng chọn.
            // Để tránh đè nhau trong trường hợp này, Tooltip của chúng ta phải "lật" ngược lên TRÊN.
            if (rect.top < 120) {
                showAtBottom = false;
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
