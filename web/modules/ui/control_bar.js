// Path: web/modules/ui/control_bar.js

export class ControlBar {
    constructor(playCallback, pauseCallback, stopCallback, speedChangeCallback) {
        this.playBtn = document.getElementById('play-all-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.speedSelect = document.getElementById('speed-select');
        
        this.playCallback = playCallback;
        this.pauseCallback = pauseCallback;
        this.stopCallback = stopCallback;
        this.speedChangeCallback = speedChangeCallback;

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
                if (this.speedChangeCallback) this.speedChangeCallback(newRate);
            });
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
