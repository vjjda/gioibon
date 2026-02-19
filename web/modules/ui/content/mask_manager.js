// Path: web/modules/ui/content/mask_manager.js

export class MaskManager {
    constructor(container) {
        this.container = container;
        this.items = [];
        this.isDraggingMask = false;
        this.dragMaskAction = null; // 'mask' or 'unmask'

        this._setupGlobalListeners();
    }

    setItems(items) {
        this.items = items;
    }

    _setupGlobalListeners() {
        const endDrag = () => {
            this.isDraggingMask = false;
            this.dragMaskAction = null;
        };
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    handleMaskStart(e, segmentEl, item) {
        if (e.cancelable) e.preventDefault(); 
        
        this.isDraggingMask = true;
        const textEl = segmentEl.querySelector('.segment-text');
        
        // Special logic for Rule Header: Toggle ALL segments in the rule
        if (item.label.endsWith('-name')) {
            this._toggleRuleMask(segmentEl, item);
            return;
        }

        // Normal toggle
        const isMasked = textEl.classList.contains('masked');
        this.dragMaskAction = isMasked ? 'unmask' : 'mask'; 
        
        this._applyMaskAction(textEl, this.dragMaskAction);
    }

    handleMaskEnter(e, segmentEl) {
        if (!this.isDraggingMask || !this.dragMaskAction) return;
        
        // Prevent masking rule headers during drag
        if (segmentEl.classList.contains('rule-header')) return;

        const textEl = segmentEl.querySelector('.segment-text');
        this._applyMaskAction(textEl, this.dragMaskAction);
    }

    _applyMaskAction(textEl, action) {
        if (action === 'mask') {
            textEl.classList.add('masked');
        } else {
            textEl.classList.remove('masked');
        }
    }

    _toggleRuleMask(headerSegmentEl, headerItem) {
        const startIndex = parseInt(headerSegmentEl.dataset.index);
        let action = 'mask'; 
        
        // Determine action based on first content segment
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (this._isStopCondition(nextItem)) break;
            
            const nextEl = this._findElement(nextItem.id);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    action = nextTextEl.classList.contains('masked') ? 'unmask' : 'mask';
                    break;
                }
            }
        }

        // Apply action
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (this._isStopCondition(nextItem)) break;

            const nextEl = this._findElement(nextItem.id);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    this._applyMaskAction(nextTextEl, action);
                }
            }
        }
    }

    _isStopCondition(item) {
        return item.label.endsWith('-name') || 
               item.label.endsWith('-chapter') || 
               item.label === 'end';
    }

    _findElement(id) {
        return this.container.querySelector(`.segment[data-id="${id}"]`);
    }
}
