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

    handleMaskEnter(e, segmentEl) {
        if (!this.isDraggingMask || !this.dragMaskAction) return;
        // Bỏ qua không mask các thẻ heading khi đang kéo chuột
        const itemId = segmentEl.dataset.id;
        const item = this.items.find(i => String(i.id) === String(itemId));
        if (item && this._isHeading(item)) return;

        const textEl = segmentEl.querySelector('.segment-text');
        this._applyMaskAction(textEl, this.dragMaskAction, itemId);
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

    // [NEW] Logic mới bao quát tất cả các cấp độ Heading
    _toggleHeadingMask(headerSegmentEl, headerItem) {
        const startIndex = parseInt(headerSegmentEl.dataset.index);
        const match = headerItem.html.match(/^<h(\d)>/i);
        if (!match) return;
        const startLevel = parseInt(match[1]);

        let action = 'mask'; 
        
        // Bước 1: Quyết định action dựa trên segment con ĐẦU TIÊN hợp lệ (không phải heading)
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (nextItem.label === 'end') break;
            
            const itemMatch = nextItem.html ? nextItem.html.match(/^<h(\d)>/i) : null;
            if (itemMatch) {
                const itemLevel = parseInt(itemMatch[1]);
                if (itemLevel <= startLevel) break; // Thoát nếu gặp Heading cấp cao hơn hoặc bằng
                continue; // Bỏ qua sub-heading, tiếp tục tìm nội dung
            }
            
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

        // Bước 2: Thực thi action lên toàn bộ content con
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (nextItem.label === 'end') break;

            const itemMatch = nextItem.html ? nextItem.html.match(/^<h(\d)>/i) : null;
            if (itemMatch) {
                const itemLevel = parseInt(itemMatch[1]);
                if (itemLevel <= startLevel) break; // Thoát nếu ra khỏi phạm vi
                continue; // [QUAN TRỌNG] Ngoại trừ các segment heading
            }

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

