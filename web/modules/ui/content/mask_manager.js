// Path: web/modules/ui/content/mask_manager.js

export class MaskManager {
    constructor(container) {
        this.container = container;
        this.items = [];
        this.isDraggingMask = false;
        this.dragMaskAction = null; // 'mask' or 'unmask'
        this.lastActionTime = 0;
        this.cooldownMs = 250; // Tránh double tap quá nhanh
        this.STORAGE_KEY = 'gioibon_masked_segments';
        this.maskedIds = new Set(this._loadMaskedState());

        // Gesture Tracking
        this.touchStart = { x: 0, y: 0, time: 0 };
        this.SWIPE_THRESHOLD_X = 30; // px (Giảm từ 40)
        this.SWIPE_THRESHOLD_Y = 40; // px (Tăng từ 30 - cho phép lệch dọc nhiều hơn chút)
        this.SWIPE_MAX_TIME = 400;   // ms (Tăng từ 300 - cho phép vuốt chậm hơn)

        this._setupGlobalListeners();
    }

    _loadMaskedState() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Failed to load masked state", e);
            return [];
        }
    }

    _saveMaskedState() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.maskedIds)));
        } catch (e) {
            console.error("Failed to save masked state", e);
        }
    }

    setItems(items) {
        this.items = items;
    }

    _setupGlobalListeners() {
        const endDrag = () => {
            if (this.isDraggingMask) {
                this.isDraggingMask = false;
                this.dragMaskAction = null;
                this._saveMaskedState(); // Save state when drag ends
            }
        };
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    // Helper kiểm tra xem có phải là thẻ heading (ngoại trừ title/subtitle)
    _isHeading(item) {
        return item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
    }

    toggleMask(segmentEl, item) {
        const now = Date.now();
        if (now - this.lastActionTime < this.cooldownMs) return;
        this.lastActionTime = now;

        const textEl = segmentEl.querySelector('.segment-text');
        if (!textEl) return;

        // [UPDATED] Thay vì chỉ check rule-name, giờ check mọi Heading
        if (this._isHeading(item)) {
            this._toggleHeadingMask(segmentEl, item);
            this._saveMaskedState();
            return;
        }

        const isMasked = textEl.classList.contains('masked');
        this._applyMaskAction(textEl, isMasked ? 'unmask' : 'mask', item.id);
        this._saveMaskedState();
    }

    handleMaskStart(e, segmentEl, item) {
        // Chỉ cho phép nút chuột trái (button 0) hoặc touch events
        if (e.type === 'mousedown' && e.button !== 0) return;

        const now = Date.now();
        if (now - this.lastActionTime < this.cooldownMs) {
            if (e && e.cancelable) e.preventDefault();
            return;
        }
        this.lastActionTime = now;

        if (e && e.cancelable) e.preventDefault();
        this.isDraggingMask = true;
        const textEl = segmentEl.querySelector('.segment-text');
        
        // [UPDATED] Toggle cho toàn bộ các thẻ thuộc Heading
        if (this._isHeading(item)) {
            this._toggleHeadingMask(segmentEl, item);
            return;
        }

        const isMasked = textEl.classList.contains('masked');
        this.dragMaskAction = isMasked ? 'unmask' : 'mask'; 
        
        this._applyMaskAction(textEl, this.dragMaskAction, item.id);
    }

    // Helper kiểm tra các đoạn "miễn nhiễm" với toggle hàng loạt
    _isImmune(item) {
        return !item.hasHint;
    }

    handleMaskEnter(e, segmentEl) {
        if (!this.isDraggingMask || !this.dragMaskAction) return;
        // Bỏ qua không mask các thẻ không có hasHint
        const itemId = segmentEl.dataset.id;
        const item = this.items.find(i => String(i.id) === String(itemId));
        if (item && !item.hasHint) return;

        const textEl = segmentEl.querySelector('.segment-text');
        this._applyMaskAction(textEl, this.dragMaskAction, itemId);
    }

    // --- Swipe Gesture Support ---

    handleSegmentTouchStart(e) {
        if (e.touches.length !== 1) return;
        this.touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now()
        };
    }

    handleSegmentTouchMove(e) {
        if (e.touches.length !== 1) return;
        
        const deltaX = Math.abs(e.touches[0].clientX - this.touchStart.x);
        const deltaY = Math.abs(e.touches[0].clientY - this.touchStart.y);

        // Nếu vuốt ngang rõ rệt hơn vuốt dọc, chặn cuộn trang để xử lý gesture (Giảm ngưỡng từ 10 xuống 5)
        if (deltaX > 5 && deltaX > deltaY) {
            if (e.cancelable) e.preventDefault();
        }
    }

    handleSegmentTouchEnd(e, segmentEl, item) {
        if (e.changedTouches.length !== 1) return;
        
        const deltaX = e.changedTouches[0].clientX - this.touchStart.x;
        const deltaY = e.changedTouches[0].clientY - this.touchStart.y;
        const deltaTime = Date.now() - this.touchStart.time;

        // Kiểm tra xem có phải là cú vuốt ngang không
        if (Math.abs(deltaX) > this.SWIPE_THRESHOLD_X && 
            Math.abs(deltaY) < this.SWIPE_THRESHOLD_Y && 
            deltaTime < this.SWIPE_MAX_TIME) {
            
            // Chặn hành vi mặc định nếu là swipe hợp lệ
            if (e.cancelable) e.preventDefault();
            
            // Kích hoạt toggle mask
            this.toggleMask(segmentEl, item);
        }
    }

    _applyMaskAction(textEl, action, id) {
        if (!id) return;
        if (action === 'mask') {
            textEl.classList.add('masked');
            this.maskedIds.add(String(id));
        } else {
            textEl.classList.remove('masked');
            this.maskedIds.delete(String(id));
        }
    }

    // Called when a segment is rendered to apply existing state
    applySavedState(segmentEl, id) {
        const textEl = segmentEl.querySelector('.segment-text');
        if (textEl && this.maskedIds.has(String(id))) {
            textEl.classList.add('masked');
        }
    }

    // [NEW] Logic mới bao quát tất cả các cấp độ Heading sử dụng dữ liệu từ DB
    _toggleHeadingMask(headerSegmentEl, headerItem) {
        const startIndex = parseInt(headerSegmentEl.dataset.index);
        const targetHeadingId = headerItem.id;

        let action = 'mask'; 
        
        // Bước 1: Quyết định action dựa trên segment con ĐẦU TIÊN hợp lệ (không phải heading và không miễn nhiễm)
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            
            // Dừng lại nếu gặp một heading khác cùng cấp hoặc cấp cao hơn (không thuộc nhánh của targetHeadingId)
            // Hoặc đơn giản là nếu nó không còn trỏ headingId về targetHeadingId nữa (tuy nhiên DB thiết kế headingId trỏ về cha gần nhất)
            // Vì vậy, một đoạn văn nằm dưới sub-heading sẽ có headingId = sub-heading-id.
            // Để giải quyết bài toán cây phả hệ đơn giản nhất: ta cứ duyệt tới khi gặp 1 heading có level <= level của headerItem
            
            if (this._isHeading(nextItem)) {
                if (nextItem.headingLevel <= headerItem.headingLevel) break; 
                continue; // Bỏ qua sub-heading, tiếp tục tìm nội dung
            }
            
            if (this._isImmune(nextItem)) continue; // Bỏ qua các đoạn không cho phép mask (has_hint=0)
            
            const nextEl = this._findElement(nextItem.id);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    action = nextTextEl.classList.contains('masked') ? 'unmask' : 'mask';
                    break;
                }
            } else {
                // If element isn't in DOM, check state
                action = this.maskedIds.has(String(nextItem.id)) ? 'unmask' : 'mask';
                break;
            }
        }

        // Bước 2: Thực thi action lên toàn bộ content con (ngoại trừ heading và miễn nhiễm)
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];

            if (this._isHeading(nextItem)) {
                if (nextItem.headingLevel <= headerItem.headingLevel) break; // Thoát nếu ra khỏi phạm vi
                continue; // [QUAN TRỌNG] Ngoại trừ các segment heading
            }

            if (this._isImmune(nextItem)) continue; // [QUAN TRỌNG] Ngoại trừ các đoạn miễn nhiễm (has_hint=0)

            const nextEl = this._findElement(nextItem.id);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    this._applyMaskAction(nextTextEl, action, nextItem.id);
                }
            } else {
                // Apply to state even if not in DOM
                if (action === 'mask') {
                    this.maskedIds.add(String(nextItem.id));
                } else {
                    this.maskedIds.delete(String(nextItem.id));
                }
            }
        }
    }

    _findElement(id) {
        return this.container.querySelector(`.segment[data-id="${id}"]`);
    }
}

