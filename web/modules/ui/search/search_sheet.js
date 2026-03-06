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
            
            // Reset lại chiều cao mặc định sau khi đóng để lần sau mở lại đúng 60vh
            setTimeout(() => {
                if (this.bottomSheet) this.bottomSheet.style.height = '';
            }, 300);
        }
    }

    _setupDragToClose() {
        if (!this.dragHandle || !this.bottomSheet) return;

        let startY = 0;
        let startHeight = 0;
        let isDragging = false;

        const onStart = (e) => {
            // Hỗ trợ cả chuột và chạm
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            startY = clientY;
            startHeight = this.bottomSheet.getBoundingClientRect().height;
            isDragging = true;
            
            this.bottomSheet.style.transition = 'none';
            document.body.style.userSelect = 'none'; // Ngăn chọn chữ khi đang kéo
            this.dragHandle.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!isDragging) return;
            
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            const deltaY = startY - clientY; // Kéo lên là dương
            
            let newHeight = startHeight + deltaY;
            const maxHeight = window.innerHeight * 0.95;
            const minHeight = 150;

            // Giới hạn chiều cao tối đa
            if (newHeight > maxHeight) newHeight = maxHeight;
            
            // Áp dụng chiều cao mới
            if (newHeight > 0) {
                this.bottomSheet.style.height = `${newHeight}px`;
            }
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            document.body.style.userSelect = '';
            this.dragHandle.style.cursor = 'grab';
            this.bottomSheet.style.transition = 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            const currentHeight = this.bottomSheet.getBoundingClientRect().height;
            const closeThreshold = 180; // Nếu kéo xuống thấp hơn mức này thì đóng sheet

            if (currentHeight < closeThreshold) {
                this.close();
            } else {
                // Có thể thêm logic snap vào các mốc cố định ở đây nếu muốn
            }
        };

        // Gán sự kiện cho handle
        this.dragHandle.addEventListener('mousedown', onStart);
        this.dragHandle.addEventListener('touchstart', onStart, { passive: true });

        // Gán sự kiện cho window để việc kéo mượt mà ngay cả khi chuột ra ngoài handle
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });

        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }
}

