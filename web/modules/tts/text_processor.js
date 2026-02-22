// Path: web/modules/tts/text_processor.js
import { BASE_URL } from 'core/config.js';

export class TextProcessor {
    constructor() {
        this.ttsRules = null;
        this.rulesPromise = this._loadRules();
    }

    async _loadRules() {
        try {
            const res = await fetch(`${BASE_URL}app-content/tts_rules.json`);
            if (res.ok) {
                this.ttsRules = await res.json();
            }
        } catch (err) {
            console.warn("⚠️ Không tìm thấy tts_rules.json", err);
        }
    }

    async normalize(text) {
        if (!text) return "";
        await this.rulesPromise; // Đảm bảo rules đã load
        
        if (!this.ttsRules) return text;

        let ttsText = text;

        if (this.ttsRules.remove_html) {
            ttsText = ttsText.replace(/<[^>]*>?/gm, '');
        }
        
        if (this.ttsRules.remove_chars) {
            const escapedChars = this.ttsRules.remove_chars.map(c => this._escapeRegExp(c)).join('');
            const pattern = new RegExp(`[${escapedChars}]`, 'g');
            ttsText = ttsText.replace(pattern, ' ');
        }

        if (this.ttsRules.collapse_spaces) {
            ttsText = ttsText.replace(/\s+/g, ' ').trim();
        }

        if (this.ttsRules.phonetics) {
            for (const [word, replacement] of Object.entries(this.ttsRules.phonetics)) {
                const regex = new RegExp(this._escapeRegExp(word), 'gi');
                ttsText = ttsText.replace(regex, replacement);
            }
        }

        if (this.ttsRules.capitalize_upper && this._isUpper(ttsText)) {
            ttsText = this._capitalize(ttsText);
        }

        return ttsText;
    }

    // --- Helpers ---
    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _isUpper(text) {
        return text === text.toUpperCase() && text !== text.toLowerCase();
    }

    _capitalize(text) {
        if (!text) return text;
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
}
