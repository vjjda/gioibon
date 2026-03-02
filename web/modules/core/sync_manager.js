// Path: web/modules/core/sync_manager.js
import { CustomDialog } from 'ui/custom_dialog.js';

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

    async exportData() {
        const data = {};
        // Lọc các key liên quan đến ứng dụng
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('gioibon_') || key.startsWith('sutta_') || key === 'theme' || key === 'fontSizeScale' || key === 'sepiaIntensity') {
                data[key] = localStorage.getItem(key);
            }
        }

        const jsonString = JSON.stringify(data, null, 2);
        const date = new Date().toISOString().split('T')[0];
        const defaultFilename = `gioibon_backup_${date}.json`;

        // Ưu tiên dùng File System Access API (trên Desktop Chrome/Edge) để cho phép chọn thư mục
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{
                        description: 'JSON Backup File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                CustomDialog.alert("Đã lưu dữ liệu thành công.", "Thành công");
                return;
            } catch (err) {
                // Người dùng hủy (AbortError) hoặc lỗi khác
                if (err.name !== 'AbortError') {
                    console.error("SaveFilePicker Error:", err);
                }
                // Fallback xuống cách tải xuống thông thường nếu bị lỗi (trừ khi cố ý hủy)
                if (err.name === 'AbortError') return;
            }
        }

        // Fallback: Tải xuống file truyền thống (Dành cho iOS Safari, Firefox, Android)
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let count = 0;
                for (const key in data) {
                    if (key.startsWith('gioibon_') || key.startsWith('sutta_') || key === 'theme' || key === 'fontSizeScale' || key === 'sepiaIntensity') {
                        localStorage.setItem(key, data[key]);
                        count++;
                    }
                }
                await CustomDialog.alert(`Đã phục hồi thành công ${count} mục dữ liệu.\nỨng dụng sẽ được tải lại để áp dụng thay đổi.`, "Thành công");
                window.location.reload();
            } catch (err) {
                console.error("Lỗi phục hồi dữ liệu:", err);
                CustomDialog.alert("File phục hồi không hợp lệ hoặc bị hỏng.", "Lỗi");
            }
        };
        reader.readAsText(file);
        
        // Reset input để có thể chọn lại file cũ nếu cần
        event.target.value = '';
    }
};