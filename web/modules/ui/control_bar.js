// Path: web/modules/ui/control_bar.js

export class ControlBar {
    constructor(onPlayAll, onPause, onStop, onSpeedChange, onLoopToggle) {
        this.playBtn = document.getElementById('play-all-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.speedSelect = document.getElementById('speed-select');
        this.loopBtn = document.getElementById('loop-btn');
        this.hintToggleBtn = document.getElementById('hint-toggle-btn');
        
        const STORAGE_KEY_LOOP = 'sutta_loop_enabled';
        const STORAGE_KEY_RATE = 'tts_rate';
        const STORAGE_KEY_HINT = 'sutta_hint_mode_enabled';

        if (this.playBtn) this.playBtn.addEventListener('click', onPlayAll);
        if (this.pauseBtn) this.pauseBtn.addEventListener('click', onPause);
        if (this.stopBtn) this.stopBtn.addEventListener('click', onStop);

        if (this.speedSelect) {
            // Nạp giá trị speed từ bộ nhớ
            const savedRate = localStorage.getItem(STORAGE_KEY_RATE);
            if (savedRate) this.speedSelect.value = savedRate;

            this.speedSelect.addEventListener('change', (e) => {
                const rate = parseFloat(e.target.value);
                localStorage.setItem(STORAGE_KEY_RATE, rate); // Lưu cấu hình
                onSpeedChange(rate);
            });
        }

        if (this.loopBtn) {
            // Nạp trạng thái loop từ bộ nhớ
            const savedLoop = localStorage.getItem(STORAGE_KEY_LOOP) === 'true';
            if (savedLoop) this.loopBtn.classList.add('active');

            this.loopBtn.addEventListener('click', () => {
                const isActive = this.loopBtn.classList.toggle('active');
                localStorage.setItem(STORAGE_KEY_LOOP, isActive); // Lưu cấu hình
                if (onLoopToggle) onLoopToggle(isActive);
            });
        }

        if (this.hintToggleBtn) {
            // Nạp trạng thái hint mode từ bộ nhớ (Mặc định là TRUE nếu chưa thiết lập)
            const savedHintModeValue = localStorage.getItem(STORAGE_KEY_HINT);
            const isHintModeActive = savedHintModeValue === null ? true : savedHintModeValue === 'true';

            if (isHintModeActive) {
                this.hintToggleBtn.classList.add('active');
                document.body.classList.add('hint-mode-active');
            }

            this.hintToggleBtn.addEventListener('click', () => {
                const isActive = this.hintToggleBtn.classList.toggle('active');
                if (isActive) {
                    document.body.classList.add('hint-mode-active');
                } else {
                    document.body.classList.remove('hint-mode-active');
                }
                localStorage.setItem(STORAGE_KEY_HINT, isActive);
            });
        }

        // Shortcut Keys
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            const key = e.key.toLowerCase();
            if (key === 'g' && this.loopBtn) this.loopBtn.click();
            if (key === 'h' && this.hintToggleBtn) this.hintToggleBtn.click();
            if (key === 't') this._changeSpeedIndex(1, onSpeedChange);
            if (key === 'e') this._changeSpeedIndex(-1, onSpeedChange);
        });
    }

    _changeSpeedIndex(direction, callback) {
        if (!this.speedSelect) return;
        const newIndex = this.speedSelect.selectedIndex + direction;
        if (newIndex >= 0 && newIndex < this.speedSelect.options.length) {
            this.speedSelect.selectedIndex = newIndex;
            const newRate = parseFloat(this.speedSelect.value);
            localStorage.setItem('tts_rate', newRate); // Lưu cấu hình
            if (callback) callback(newRate);
        }
    }

    updateState(state) {
        if (!this.playBtn || !this.pauseBtn || !this.stopBtn) return;
        const pauseIcon = this.pauseBtn.querySelector('i');

        switch (state) {
            case 'playing':
                this.playBtn.disabled = true;
                this.pauseBtn.disabled = false;
                this.stopBtn.disabled = false;
                if (pauseIcon) {
                    pauseIcon.classList.remove('fa-play');
                    pauseIcon.classList.add('fa-pause');
                }
                break;
            case 'paused':
                this.playBtn.disabled = true;
                this.pauseBtn.disabled = false;
                this.stopBtn.disabled = false;
                if (pauseIcon) {
                    pauseIcon.classList.remove('fa-pause');
                    pauseIcon.classList.add('fa-play');
                }
                break;
            case 'stopped':
                this.playBtn.disabled = false;
                this.pauseBtn.disabled = true;
                this.stopBtn.disabled = true;
                if (pauseIcon) {
                    pauseIcon.classList.remove('fa-play');
                    pauseIcon.classList.add('fa-pause');
                }
                break;
        }
    }

    setSpeed(rate) {
        if (this.speedSelect) {
            this.speedSelect.value = rate.toString();
        }
    }
}