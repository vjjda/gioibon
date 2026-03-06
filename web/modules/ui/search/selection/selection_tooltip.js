// Path: web/modules/ui/search/selection/selection_tooltip.js
export class SelectionTooltip {
    constructor() {
        this.element = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        this.colorBtns = this.element ? this.element.querySelectorAll('.color-btn') : [];
    }

    bindEvents(onSearchCallback, onColorCallback) {
        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                onSearchCallback();
            });
        }

        if (this.colorBtns) {
            this.colorBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onColorCallback(btn.dataset.color);
                });
            });
        }
    }

    contains(target) {
        return (this.element && this.element.contains(target)) || 
               (this.btnSearch && this.btnSearch.contains(target));
    }

    showAtRect(rect) {
        if (!this.element || !rect) return;

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

        this.element.style.left = `${left}px`;

        if (showAtBottom) {
            this.element.style.top = `${bottom}px`;
            this.element.classList.add('at-bottom');
        } else {
            this.element.style.top = `${top}px`;
            this.element.classList.remove('at-bottom');
        }
        
        this.element.classList.remove('hidden');
    }

    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }
}

