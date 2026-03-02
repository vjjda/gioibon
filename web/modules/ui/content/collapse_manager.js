// Path: web/modules/ui/content/collapse_manager.js

export class CollapseManager {
    constructor(getItems, getElementCache) {
        this.getItems = getItems;
        this.getElementCache = getElementCache;
        this.isOutlineMode = false;
        this.storageKey = 'sutta_normal_collapsed_ids';
        
        // normalCollapsedIds: Lưu các heading mà người dùng đã chủ động thu gọn ở chế độ bình thường.
        this.normalCollapsedIds = new Set(this._loadFromStorage());
        
        // outlineExpandedIds: Lưu các heading mà người dùng đã chủ động mở rộng khi đang ở chế độ Outline.
        // Tập hợp này sẽ được reset mỗi khi bật Outline Mode để đảm bảo bắt đầu từ trạng thái "thu gọn tất cả".
        this.outlineExpandedIds = new Set();
        
        this.hiddenItemIds = new Set();
    }

    _loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load collapse state", e);
            return [];
        }
    }

    _saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify([...this.normalCollapsedIds]));
        } catch (e) {
            console.error("Failed to save collapse state", e);
        }
    }

    setOutlineMode(enabled) {
        this.isOutlineMode = enabled;
        // Mỗi khi bật Outline Mode, reset trạng thái mở rộng tạm thời
        if (enabled) {
            this.outlineExpandedIds.clear();
        }
        this._recalculateHiddenItems();
        this.applyToDOM();
    }

    toggleCollapse(headingId) {
        const items = this.getItems();
        const headingIndex = items.findIndex(i => i.id === headingId);
        if (headingIndex === -1) return;

        const headingItem = items[headingIndex];
        const match = headingItem.html.match(/^<h(\d)/i);
        const level = parseInt(match[1]);

        if (this.isOutlineMode) {
            // TRONG CHẾ ĐỘ OUTLINE:
            // Mặc định là Collapsed. Click để Expand.
            const willExpand = !this.outlineExpandedIds.has(headingId);
            
            this._recursiveUpdate(headingIndex, level, (id) => {
                if (willExpand) {
                    this.outlineExpandedIds.add(id);
                    // Nếu đã chủ động mở rộng trong Outline, ta cũng muốn nó được mở rộng khi quay lại Normal Mode
                    this.normalCollapsedIds.delete(id);
                } else {
                    this.outlineExpandedIds.delete(id);
                    // Nếu đã chủ động thu gọn trong Outline (về mặc định), ta coi như nó cũng nên thu gọn ở Normal Mode
                    this.normalCollapsedIds.add(id);
                }
            });
        } else {
            // TRONG CHẾ ĐỘ BÌNH THƯỜNG:
            // Mặc định là Expanded. Click để Collapse.
            const willCollapse = !this.normalCollapsedIds.has(headingId);

            this._recursiveUpdate(headingIndex, level, (id) => {
                if (willCollapse) {
                    this.normalCollapsedIds.add(id);
                } else {
                    this.normalCollapsedIds.delete(id);
                }
            });
        }

        this._saveToStorage();
        this._recalculateHiddenItems();
        this.applyToDOM();
    }

    _recursiveUpdate(startIndex, level, callback) {
        const items = this.getItems();
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i];
            const match = item.html ? item.html.match(/^<h(\d)/i) : null;
            const isHeading = match && item.label !== 'title' && item.label !== 'subtitle';
            
            if (isHeading) {
                const itemLevel = parseInt(match[1]);
                if (i > startIndex && itemLevel <= level) break;
                callback(item.id);
            }
        }
    }

    _recalculateHiddenItems() {
        this.hiddenItemIds.clear();
        const items = this.getItems();
        let currentNearestHeadingCollapsed = this.isOutlineMode;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isHeadingMatch = item.html ? item.html.match(/^<h([1-6])/i) : null;
            const isHeading = isHeadingMatch && item.label !== 'title' && item.label !== 'subtitle';
            
            if (isHeading) {
                if (this.isOutlineMode) {
                    // Chế độ Outline: Thu gọn trừ khi nằm trong tập được mở rộng
                    currentNearestHeadingCollapsed = !this.outlineExpandedIds.has(item.id);
                } else {
                    // Chế độ Bình thường: Mở rộng trừ khi nằm trong tập bị thu gọn
                    currentNearestHeadingCollapsed = this.normalCollapsedIds.has(item.id);
                }
            } else {
                if (currentNearestHeadingCollapsed) {
                    this.hiddenItemIds.add(item.id);
                }
            }
        }
    }

    applyToDOM() {
        const cache = this.getElementCache();
        const items = this.getItems();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const el = cache.get(item.id);
            if (el) {
                this.applyToElement(el, item);
            }
        }
    }

    applyToElement(el, item) {
        if (!item) return;
        const id = item.id;

        const isHeadingMatch = item.html ? item.html.match(/^<h([1-6])/i) : null;
        const isHeading = isHeadingMatch && item.label !== 'title' && item.label !== 'subtitle';

        if (isHeading) {
            let isCollapsed;
            if (this.isOutlineMode) {
                isCollapsed = !this.outlineExpandedIds.has(id);
            } else {
                isCollapsed = this.normalCollapsedIds.has(id);
            }
            
            if (isCollapsed) {
                el.classList.add('is-collapsed');
            } else {
                el.classList.remove('is-collapsed');
            }
        } else {
            if (this.hiddenItemIds.has(id)) {
                el.classList.add('hidden-by-collapse');
            } else {
                el.classList.remove('hidden-by-collapse');
            }
        }
    }
}
