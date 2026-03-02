// Path: web/modules/ui/custom_dialog.js

export const CustomDialog = {
    _show(message, title, type) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog-modal');
            const titleEl = document.getElementById('custom-dialog-title');
            const messageEl = document.getElementById('custom-dialog-message');
            const okBtn = document.getElementById('custom-dialog-ok-btn');
            const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

            if (!modal) {
                // Fallback to native if DOM is not ready
                if (type === 'confirm') resolve(window.confirm(message));
                else { window.alert(message); resolve(true); }
                return;
            }

            titleEl.textContent = title;
            messageEl.textContent = message;

            if (type === 'alert') {
                cancelBtn.style.display = 'none';
                okBtn.textContent = 'OK';
            } else {
                cancelBtn.style.display = 'block';
                okBtn.textContent = 'Đồng ý';
            }

            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
            };

            const onOk = () => {
                cleanup();
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    },

    alert(message, title = "Thông báo") {
        return this._show(message, title, 'alert');
    },

    confirm(message, title = "Xác nhận") {
        return this._show(message, title, 'confirm');
    }
};
