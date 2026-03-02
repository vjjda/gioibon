// Path: web/modules/core/sync_manager.js

export const SyncManager = {
    init() {
        this.exportBtn = document.getElementById('btn-export-data');
        this.importBtn = document.getElementById('btn-import-data');
        this.fileInput = document.getElementById('file-import-data');

        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportData());
        }

        if (this.importBtn && this.fileInput) {
            this.importBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.importData(e));
        }
    },

    exportData() {
        const data = {};
        // Lọc các key liên quan đến ứng dụng
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('gioibon_') || key.startsWith('sutta_') || key === 'theme' || key === 'fontSizeScale' || key === 'sepiaIntensity') {
                data[key] = localStorage.getItem(key);
            }
        }

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `gioibon_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let count = 0;
                for (const key in data) {
                    if (key.startsWith('gioibon_') || key.startsWith('sutta_') || key === 'theme' || key === 'fontSizeScale' || key === 'sepiaIntensity') {
                        localStorage.setItem(key, data[key]);
                        count++;
                    }
                }
                alert(`Đã phục hồi thành công ${count} mục dữ liệu.
Ứng dụng sẽ được tải lại để áp dụng thay đổi.`);
                window.location.reload();
            } catch (err) {
                console.error("Lỗi phục hồi dữ liệu:", err);
                alert("File phục hồi không hợp lệ hoặc bị hỏng.");
            }
        };
        reader.readAsText(file);
        
        // Reset input để có thể chọn lại file cũ nếu cần
        event.target.value = '';
    }
};