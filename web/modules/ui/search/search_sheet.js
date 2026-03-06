// Path: web/modules/ui/search/search_sheet.js
export class SearchSheet {
    constructor() {
        this.bottomSheet = document.getElementById('search-bottom-sheet');
        this.sheetOverlay = document.getElementById('search-sheet-overlay');
        this.btnCloseSheet = document.getElementById('btn-close-search-sheet');
        this.dragHandle = this.bottomSheet?.querySelector('.bottom-sheet-drag-handle');

        this._setupListeners();
        this._setupDragToClose();
    }

    _setupListeners() {
        if (this.btnCloseSheet) {
            this.btnCloseSheet.addEventListener('click', () => this.close());
        }

        if (this.sheetOverlay) {
            this.sheetOverlay.addEventListener('click', () => this.close());
        }
    }

    open() {
        if (this.bottomSheet && this.sheetOverlay) {
            this.bottomSheet.classList.remove('hidden');
            this.sheetOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.bottomSheet && this.sheetOverlay) {
            this.bottomSheet.classList.add('hidden');
            this.sheetOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    _setupDragToClose() {
        if (!this.dragHandle || !this.bottomSheet) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            this.bottomSheet.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) { // Only drag downwards
                this.bottomSheet.style.transform = `translateY(${deltaY}px)`;
            }
        };

        const onTouchEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            this.bottomSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            const deltaY = currentY - startY;
            if (deltaY > 100) { // Threshold
                this.close();
                setTimeout(() => {
                    this.bottomSheet.style.transform = '';
                }, 300);
            } else {
                this.bottomSheet.style.transform = 'translateY(0)';
            }
        };

        this.dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);
    }
}

