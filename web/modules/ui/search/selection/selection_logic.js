// Path: web/modules/ui/search/selection/selection_logic.js
export class SelectionLogic {
    constructor(searchRenderer, highlightManager) {
        this.searchRenderer = searchRenderer;
        this.highlightManager = highlightManager;
        this.activeSegmentId = null;
        this.activeHighlightId = null;
        this.currentSelection = '';
    }

    resetActiveHighlight() {
        this.activeHighlightId = null;
    }

    handleHighlightClick(segmentEl, highlightId) {
        const spans = Array.from(segmentEl.querySelectorAll(`.user-highlight[data-highlight-id="${highlightId}"]`));
        if (spans.length === 0) return null;

        this.activeSegmentId = segmentEl.dataset.id;
        this.activeHighlightId = highlightId;
        this.currentSelection = spans.map(s => s.textContent).join('');

        const range = document.createRange();
        range.setStartBefore(spans[0]);
        range.setEndAfter(spans[spans.length - 1]);
        return range.getBoundingClientRect();
    }

    applyColor(color) {
        if (!this.activeSegmentId || !this.highlightManager) return;

        if (this.activeHighlightId) {
            const existingHighlights = this.highlightManager.getHighlights(this.activeSegmentId);
            const targetHighlight = existingHighlights.find(h => h.id === this.activeHighlightId);

            if (targetHighlight) {
                this.highlightManager.removeHighlight(this.activeSegmentId, this.activeHighlightId);
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
        } else {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const segmentEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
            if (!segmentEl) return;

            const offsets = this.highlightManager.constructor.getSelectionOffsets(selection, segmentEl);
            if (offsets.start === offsets.end) return;

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

        this.refreshSegmentDOM(this.activeSegmentId);
    }

    refreshSegmentDOM(segmentId) {
        const segmentEl = document.querySelector(`.segment[data-id="${segmentId}"]`);
        if (segmentEl && this.searchRenderer.contentRenderer && this.searchRenderer.contentRenderer.refreshSegment) {
            this.searchRenderer.contentRenderer.refreshSegment(segmentId);
        }
    }

    highlightActiveSegment(selection) {
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

    performSearch() {
        this.searchRenderer.performSearch(this.currentSelection, this.activeSegmentId);
    }
}

