// Path: web/modules/ui/settings_modal.js

export class SettingsModal {
    constructor(ttsEngine) {
        this.ttsEngine = ttsEngine;
        this.modal = document.getElementById('settings-modal');
        this.openBtn = document.getElementById('settings-btn');
        this.closeBtn = document.querySelector('.close-modal');
        this.saveBtn = document.getElementById('save-settings');
        this.apiKeyInput = document.getElementById('api-key');
        this.voiceSelect = document.getElementById('voice-select');
        this.refreshVoicesBtn = document.getElementById('refresh-voices-btn');

        this._setupListeners();
    }

    _setupListeners() {
        if (this.openBtn) {
            this.openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._open();
            });
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._close();
            });
        } else {
            console.error("SettingsModal: Close button not found");
        }

        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._save();
            });
        } else {
            console.error("SettingsModal: Save button not found");
        }

        if (this.refreshVoicesBtn) {
            this.refreshVoicesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._loadVoices(true);
            });
        }

        if (this.voiceSelect) {
            this.voiceSelect.addEventListener('change', (e) => {
                this.ttsEngine.setVoice(e.target.value);
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this._close();
            }
        });
        
        // Handle Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this._close();
            }
        });
    }

    _open() {
        try {
            this.modal.classList.remove('hidden');
            
            if (this.ttsEngine) {
                if (this.apiKeyInput) this.apiKeyInput.value = this.ttsEngine.getApiKey() || '';
                this._loadVoices(false);
            }
        } catch (error) {
            console.error("Error opening settings modal:", error);
        }
    }

    _close() {
        this.modal.classList.add('hidden');
    }

    _save() {
        try {
            const key = this.apiKeyInput ? this.apiKeyInput.value.trim() : '';
            // Always save, even if empty (clearing the key)
            this.ttsEngine.setApiKey(key);
            this._close();
            
            // Only reload voices if we have a key
            if (key) {
                this._loadVoices(true); 
            } else {
                // Clear voice list if key removed
                if (this.voiceSelect) this.voiceSelect.innerHTML = '<option value="" disabled selected>Vui lòng nhập API Key</option>';
            }
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    }

    async _loadVoices(forceRefresh) {
        if (!this.ttsEngine || !this.ttsEngine.getApiKey()) {
            if (this.voiceSelect) this.voiceSelect.innerHTML = '<option value="" disabled selected>Vui lòng nhập API Key trước</option>';
            return;
        }

        if (this.voiceSelect) this.voiceSelect.innerHTML = '<option value="" disabled selected>Đang tải...</option>';
        if (this.refreshVoicesBtn) {
            this.refreshVoicesBtn.disabled = true;
            this.refreshVoicesBtn.innerHTML = '<i class="fas fa-spin fa-spinner"></i>';
        }

        try {
            const voices = await this.ttsEngine.getVoices(forceRefresh);
            if (this.voiceSelect) {
                this.voiceSelect.innerHTML = '';
                
                const currentVoice = this.ttsEngine.currentVoice;
                const currentVoiceName = currentVoice ? currentVoice.name : '';
    
                if (!voices || voices.length === 0) {
                    this.voiceSelect.innerHTML = '<option value="" disabled selected>Không tìm thấy giọng tiếng Việt</option>';
                } else {
                    voices.forEach(v => {
                        const option = document.createElement('option');
                        option.value = v.name;
                        option.textContent = `${v.name} (${v.ssmlGender})`;
                        if (v.name === currentVoiceName) {
                            option.selected = true;
                        }
                        this.voiceSelect.appendChild(option);
                    });
    
                    if (voices.length > 0 && !voices.find(v => v.name === currentVoiceName)) {
                        this.voiceSelect.selectedIndex = 0;
                        this.ttsEngine.setVoice(voices[0].name);
                    }
                }
            }
        } catch (e) {
            console.error("Error loading voices:", e);
            if (this.voiceSelect) this.voiceSelect.innerHTML = '<option value="" disabled selected>Lỗi tải giọng</option>';
        } finally {
            if (this.refreshVoicesBtn) {
                this.refreshVoicesBtn.disabled = false;
                this.refreshVoicesBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }
        }
    }
}
