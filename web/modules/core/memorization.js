// Path: web/modules/core/memorization.js
import { CustomDialog } from 'ui/custom_dialog.js';

export class MemorizationManager {
    constructor() {
        this.STORAGE_KEY = 'gioibon_memorization_progress';
        this.progress = this._load();
        this.listeners = [];
    }

    _load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error("Failed to load memorization progress", e);
            return {};
        }
    }

    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.progress));
            this._notify();
        } catch (e) {
            console.error("Failed to save memorization progress", e);
        }
    }

    getLevel(ruleLabel) {
        return this.progress[ruleLabel] || 0;
    }

    setLevel(ruleLabel, level) {
        if (level === 0) {
            delete this.progress[ruleLabel];
        } else {
            this.progress[ruleLabel] = level;
        }
        this._save();
    }

    async resetAll() {
        if (await CustomDialog.confirm("Bạn có chắc chắn muốn xóa toàn bộ tiến độ thuộc các giới luật?", "Xóa tiến độ")) {
            this.progress = {};
            this._save();
        }
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    _notify() {
        this.listeners.forEach(callback => callback(this.progress));
    }
}
