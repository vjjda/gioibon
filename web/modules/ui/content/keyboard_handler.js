// Path: web/modules/ui/content/keyboard_handler.js

export class KeyboardHandler {
    constructor(getHoveredId, getItems, getElementCache, maskManager, playSegment, playSequence) {
        this.getHoveredId = getHoveredId;
        this.getItems = getItems;
        this.getElementCache = getElementCache;
        this.maskManager = maskManager;
        this.playSegment = playSegment;
        this.playSequence = playSequence;

        this._setupKeyboardListeners();
    }

    _setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const key = e.key.toLowerCase();
            if (key === 'r') {
                this._handleKeyboardPlay();
            } else if (key === 'f') {
                this._handleKeyboardFlip();
            }
        });
    }

    _handleKeyboardPlay() {
        const hoveredId = this.getHoveredId();
        if (!hoveredId) return;
        
        const items = this.getItems();
        const item = items.find(i => i.id === hoveredId);
        if (!item) return;
        
        if (item.html && item.html.match(/^<h[1-6]/i)) {
            const index = items.indexOf(item);
            this.playSequence(index);
        } else {
            if (item.audio && item.audio !== 'skip' && this.playSegment) {
                this.playSegment(item.id, item.audio, item.text);
            }
        }
    }

    _handleKeyboardFlip() {
        const hoveredId = this.getHoveredId();
        if (!hoveredId) return;
        
        const items = this.getItems();
        const item = items.find(i => i.id === hoveredId);
        if (!item) return;
        
        const elementCache = this.getElementCache();
        const segmentEl = elementCache.get(hoveredId);
        
        if (segmentEl) {
            const hasAudio = item.audio && item.audio !== 'skip';
            const isHeading = item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
            
            if (hasAudio || isHeading) {
                this.maskManager.toggleMask(segmentEl, item);
            }
        }
    }
}

