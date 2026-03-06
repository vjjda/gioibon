// Path: web/modules/ui/search/selection/selection_handler.js
import { SelectionTooltip } from 'ui/search/selection/selection_tooltip.js';
import { SelectionLogic } from 'ui/search/selection/selection_logic.js';

export class SelectionHandler {
    constructor(searchRenderer, highlightManager) {
        this.tooltip = new SelectionTooltip();
        this.logic = new SelectionLogic(searchRenderer, highlightManager);
        
        this._selectionTimer = null;
        this._isInteracting = false; 

        this._setupListeners();
        console.log("✅ SelectionHandler refactored into a modular architecture.");
    }

    _setupListeners() {
        // Ủy quyền sự kiện click nút cho class logic xử lý
        this.tooltip.bindEvents(
            () => { // onSearch
                this.tooltip.hide();
                this.logic.performSearch();
            },
            (color) => { // onColor
                this.logic.applyColor(color);
                this.tooltip.hide();
            }
        );

        const startInteracting = (e) => {
            if (this.tooltip.contains(e.target)) return;
            this._isInteracting = true;
            this.tooltip.hide();
        };

        const endInteracting = (e) => {
            if (this._isInteracting) {
                this._isInteracting = false;
                this._debouncedShowTooltip(50);
            }
        };

        document.addEventListener('selectionchange', () => {
            if (this._isInteracting) {
                this.tooltip.hide();
            } else {
                if (!this.logic.activeHighlightId) {
                    this.tooltip.hide();
                }
                this._debouncedShowTooltip(400); 
            }
        });

        document.addEventListener('mousedown', startInteracting);
        document.addEventListener('mouseup', endInteracting);
        document.addEventListener('touchstart', startInteracting, { passive: true });
        document.addEventListener('touchend', endInteracting);
        document.addEventListener('touchcancel', endInteracting);

        // Bắt sự kiện Click lên thẻ Highlight
        document.addEventListener('click', (e) => {
            const highlightEl = e.target.closest('.user-highlight');
            if (highlightEl) {
                e.stopPropagation();
                e.preventDefault();

                const highlightId = highlightEl.dataset.highlightId;
                const segmentEl = highlightEl.closest('.segment');
                if (highlightId && segmentEl) {
                    const rect = this.logic.handleHighlightClick(segmentEl, highlightId);
                    if (rect) {
                        window.getSelection().removeAllRanges();
                        this.tooltip.showAtRect(rect);
                    }
                }
            }
        }, true);
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
            if (!this.logic.activeHighlightId) {
                this.tooltip.hide();
            }
            return;
        }

        const text = selection.toString().trim();
        if (text.length > 1 && text.length < 150) {
            this.logic.resetActiveHighlight();
            this.logic.currentSelection = text;
            
            const range = selection.getRangeAt(0);
            let rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                const rects = range.getClientRects();
                if (rects.length > 0) rect = rects[0];
                else return;
            }

            requestAnimationFrame(() => this.tooltip.showAtRect(rect));
            this.logic.highlightActiveSegment(selection);
        } else {
            if (!this.logic.activeHighlightId) {
                this.tooltip.hide();
            }
        }
    }
}

