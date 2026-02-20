// Path: web/modules/ui/control_bar.js

export class ControlBar {
    constructor(playCallback, pauseCallback, stopCallback, speedChangeCallback, loopToggleCallback) {
        this.playBtn = document.getElementById('play-all-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.speedSelect = document.getElementById('speed-select');
        this.loopBtn = document.getElementById('loop-btn');
        
        this.playCallback = playCallback;
        this.pauseCallback = pauseCallback;
        this.stopCallback = stopCallback;
        this.speedChangeCallback = speedChangeCallback;
        this.loopToggleCallback = loopToggleCallback;

        this._setupListeners();
    }

    _setupListeners() {
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => {
                if (this.playCallback) this.playCallback();
            });
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => {
                if (this.pauseCallback) this.pauseCallback();
            });
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                if (this.stopCallback) this.stopCallback();
            });
        }
        if (this.speedSelect) {
            this.speedSelect.addEventListener('change', (e) => {
                const newRate = parseFloat(e.target.value);
                if (this.speedChangeCallback) {
                    this.speedChangeCallback(newRate);
                }
                // [FIX] Blur focus after selection so global shortcuts work immediately
                e.target.blur();
            });
        }
        // Xử lý sự kiện nút Loop
        if (this.loopBtn) {
            this.loopBtn.addEventListener('click', () => {
                this.loopBtn.classList.toggle('active');
                const isLooping = this.loopBtn.classList.contains('active');
                if (this.loopToggleCallback) this.loopToggleCallback(isLooping);
            });
        }

        // [NEW] Global keyboard shortcuts cho Control Bar
        document.addEventListener('keydown', (e) => {
            // Ngăn việc kích hoạt phím tắt khi đang nhập liệu (ví dụ: trong form cài đặt)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            // Note: We removed SELECT from the check above so shortcuts work even if focused (though blur handles it)
            // but strict check: if user is actively changing dropdown with arrows, we might want to let them.
            // However, our request is for 't' and 'e' to work globally.

            const key = e.key.toLowerCase();
            
            // Loop Toggle
            if (key === 'g') {
                e.preventDefault(); 
                if (this.loopBtn) {
                    this.loopBtn.click(); 
                }
            }

            // Speed Control Shortcuts
            // 't' -> Increase Speed
            if (key === 't') {
                e.preventDefault();
                this._changeSpeedIndex(1);
            }

            // 'e' -> Decrease Speed
            if (key === 'e') {
                e.preventDefault();
                this._changeSpeedIndex(-1);
            }
        });
    }

    _changeSpeedIndex(direction) {
        if (!this.speedSelect) return;

        const currentIndex = this.speedSelect.selectedIndex;
        const newIndex = currentIndex + direction;

        // Check bounds
        if (newIndex >= 0 && newIndex < this.speedSelect.options.length) {
            this.speedSelect.selectedIndex = newIndex;
            const newRate = parseFloat(this.speedSelect.value);
            
            // Trigger callback
            if (this.speedChangeCallback) {
                this.speedChangeCallback(newRate);
            }
            
            // Visual feedback (optional but helpful)
            // We could briefly show the new speed, but the select updates itself.
        }
    }

    // Initialize speed select with current rate
    setSpeed(rate) {
        if (this.speedSelect) {
            this.speedSelect.value = rate.toString();
        }
    }

    updateState(state) {
        if (!this.playBtn || !this.pauseBtn || !this.stopBtn) return;
        // state: 'playing', 'paused', 'stopped'
        if (state === 'playing') {
            this.playBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            
            // Icon only
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.pauseBtn.title = "Tạm dừng";
        } else if (state === 'paused') {
            this.playBtn.disabled = false;
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.pauseBtn.title = "Tiếp tục";
        } else {
            this.playBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.stopBtn.disabled = true;
            
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.pauseBtn.title = "Tạm dừng";
        }
    }
}