// Path: web/modules/ui/content/playback_ui.js

export class PlaybackUIUpdater {
    constructor(container, elementCache) {
        this.container = container;
        this.elementCache = elementCache;
    }

    update(state, activeSegmentId, isSequence, sequenceParentId) {
        if (!this.container) return;

        // Reset all buttons
        this.container.querySelectorAll('.play-btn:not(.play-sequence-btn)').forEach(btn => {
            btn.classList.remove('active-play');
            btn.innerHTML = '<i class="fas fa-circle"></i>';
            btn.title = "Nghe đoạn này";
        });
        
        this.container.querySelectorAll('.play-sequence-btn').forEach(btn => {
            btn.classList.remove('active-play');
            btn.innerHTML = '<i class="fas fa-play-circle"></i>';
            btn.title = "Nghe toàn bộ phần này";
        });
        
        if (!activeSegmentId || state === 'stopped') return;

        // Active state for specific segment
        const activeEl = this.elementCache.get(activeSegmentId);
        if (activeEl) {
            const segmentBtn = activeEl.querySelector('.play-btn:not(.play-sequence-btn)');
            if (segmentBtn) {
                segmentBtn.classList.add('active-play');
                segmentBtn.innerHTML = state === 'playing' ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
                segmentBtn.title = state === 'playing' ? "Tạm dừng" : "Tiếp tục";
            }
        }

        // Active state for parent sequence
        if (isSequence && sequenceParentId) {
            const parentEl = this.elementCache.get(sequenceParentId);
            if (parentEl) {
                const seqBtn = parentEl.querySelector('.play-sequence-btn');
                if (seqBtn) {
                    seqBtn.classList.add('active-play');
                    seqBtn.innerHTML = state === 'playing' ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
                    seqBtn.title = state === 'playing' ? "Tạm dừng" : "Tiếp tục";
                }
            }
        }
    }
}

