// Path: web/modules/ui/content_renderer.js

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        this.items = []; 
        this.isDraggingMask = false;
        this.dragMaskAction = null; // 'mask' or 'unmask'
        this.hoveredSegmentId = null;

        this._setupGlobalListeners();
    }

    _setupGlobalListeners() {
        // Drag Mask Listeners
        document.addEventListener('mouseup', () => {
            this.isDraggingMask = false;
            this.dragMaskAction = null;
        });
        document.addEventListener('touchend', () => {
            this.isDraggingMask = false;
            this.dragMaskAction = null;
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') {
                this._handleKeyboardPlay();
            }
        });
    }

    render(items) {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.items = items || [];
        
        if (!this.items || this.items.length === 0) {
            this.container.innerHTML = '<div class="empty">Không có dữ liệu hiển thị.</div>';
            return;
        }

        let currentSection = null;
        let currentPrefix = null;

        this.items.forEach((item, index) => {
            let prefix = 'misc';
            if (['title', 'subtitle', 'nidana'].includes(item.label)) {
                prefix = 'intro';
            } else if (item.label === 'end') {
                prefix = 'outro';
            } else if (item.label.startsWith('note-')) {
                prefix = currentPrefix || 'intro'; 
            } else {
                const match = item.label.match(/^([a-z]+)/);
                if (match) {
                    prefix = match[1];
                }
            }
            
            const isSectionStart = 
                (prefix !== currentPrefix) || 
                (item.label.endsWith('-chapter')) ||
                (item.label === 'title');

            if (isSectionStart || !currentSection) {
                currentPrefix = prefix;
                currentSection = document.createElement('section');
                currentSection.className = `section section-${prefix}`;
                currentSection.id = `section-${item.label}`; 
                this.container.appendChild(currentSection);
            }

            const segmentEl = this._createSegment(item, index);
            currentSection.appendChild(segmentEl);
        });
    }

    _createSegment(item, index) {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'segment';
        segmentEl.dataset.id = item.id;
        segmentEl.dataset.label = item.label;
        segmentEl.dataset.index = index; 
        
        // Track hover for keyboard shortcut
        segmentEl.addEventListener('mouseenter', () => {
            this.hoveredSegmentId = item.id;
        });

        if (item.label.endsWith('-name')) {
            segmentEl.classList.add('rule-header');
        } else if (item.label.endsWith('-chapter')) {
            segmentEl.classList.add('chapter-header');
        } else if (item.label === 'title') {
            segmentEl.classList.add('main-title');
        }

        if (item.html && item.html.match(/class=['"](endsection|endvagga|endsutta|sadhu|namo)['"]/)) {
            segmentEl.classList.add('end-segment');
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'segment-content-wrapper';

        // Play Button
        if (item.audio && item.audio !== 'skip') {
            const playBtn = document.createElement('button');
            playBtn.className = 'play-btn icon-btn';
            playBtn.innerHTML = '<i class="fas fa-circle"></i>';
            playBtn.title = "Nghe đoạn này";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.playSegmentCallback) this.playSegmentCallback(item.id, item.audio, item.segment);
            };
            contentWrapper.appendChild(playBtn);
        }

        // Play Rule Button
        if (item.label.endsWith('-name')) {
            const playRuleBtn = document.createElement('button');
            playRuleBtn.className = 'play-btn icon-btn play-rule-btn';
            playRuleBtn.innerHTML = '<i class="fas fa-play-circle"></i>';
            playRuleBtn.title = "Nghe toàn bộ điều này";
            playRuleBtn.onclick = (e) => {
                e.stopPropagation();
                this._handlePlayRule(index);
            };
            contentWrapper.appendChild(playRuleBtn);
        }

        // Text Content
        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        const htmlTemplate = item.html || '{}';
        const renderedHtml = htmlTemplate.replace('{}', item.segment || '');
        textEl.innerHTML = renderedHtml;

        contentWrapper.appendChild(textEl);
        segmentEl.appendChild(contentWrapper);

        // --- Flashcard Toggle Area ---
        const isRuleHeader = item.label.endsWith('-name');
        const hasAudio = item.audio && item.audio !== 'skip';

        if (hasAudio || isRuleHeader) {
            const toggleArea = document.createElement('div');
            toggleArea.className = 'segment-mask-toggle';
            toggleArea.title = "Nhấp để che/hiện text";
            
            // Mouse Events for Drag
            toggleArea.addEventListener('mousedown', (e) => this._startMaskDrag(e, segmentEl, item));
            toggleArea.addEventListener('mouseenter', (e) => this._continueMaskDrag(e, segmentEl));
            
            // Touch Events
            toggleArea.addEventListener('touchstart', (e) => this._startMaskDrag(e, segmentEl, item), { passive: false });
            
            segmentEl.appendChild(toggleArea);
        }
        
        return segmentEl;
    }

    _startMaskDrag(e, segmentEl, item) {
        if (e.cancelable) e.preventDefault(); 
        
        this.isDraggingMask = true;
        const textEl = segmentEl.querySelector('.segment-text');
        
        // Special logic for Rule Header
        if (item.label.endsWith('-name')) {
            this._toggleRuleMask(segmentEl, item);
            return;
        }

        // Normal toggle
        const isMasked = textEl.classList.contains('masked');
        this.dragMaskAction = isMasked ? 'unmask' : 'mask'; 
        
        this._applyMaskAction(textEl, this.dragMaskAction);
    }

    _continueMaskDrag(e, segmentEl) {
        if (!this.isDraggingMask || !this.dragMaskAction) return;
        
        // [FIX] Never mask rule headers during drag
        if (segmentEl.classList.contains('rule-header')) return;

        const textEl = segmentEl.querySelector('.segment-text');
        this._applyMaskAction(textEl, this.dragMaskAction);
    }

    _applyMaskAction(textEl, action) {
        if (action === 'mask') {
            textEl.classList.add('masked');
        } else {
            textEl.classList.remove('masked');
        }
    }

    _toggleRuleMask(headerSegmentEl, headerItem) {
        const startIndex = parseInt(headerSegmentEl.dataset.index);
        let action = 'mask'; 
        
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (nextItem.label.endsWith('-name') || nextItem.label.endsWith('-chapter') || nextItem.label === 'end') break;
            
            const nextEl = this.container.querySelector(`.segment[data-id="${nextItem.id}"]`);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    action = nextTextEl.classList.contains('masked') ? 'unmask' : 'mask';
                    break;
                }
            }
        }

        for (let i = startIndex + 1; i < this.items.length; i++) {
            const nextItem = this.items[i];
            if (nextItem.label.endsWith('-name') || nextItem.label.endsWith('-chapter') || nextItem.label === 'end') break;

            const nextEl = this.container.querySelector(`.segment[data-id="${nextItem.id}"]`);
            if (nextEl) {
                const nextTextEl = nextEl.querySelector('.segment-text');
                if (nextTextEl) {
                    this._applyMaskAction(nextTextEl, action);
                }
            }
        }
    }

    _handlePlayRule(startIndex) {
        if (!this.playSequenceCallback) return;
        const sequence = [];
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.label.endsWith('-name')) break; 
            if (item.label.endsWith('-chapter')) break; 
            if (item.label === 'end') break;
            if (item.audio && item.audio !== 'skip') {
                sequence.push({ id: item.id, audio: item.audio, text: item.segment });
            }
        }
        if (sequence.length > 0) this.playSequenceCallback(sequence);
        else alert("Không có dữ liệu âm thanh cho điều luật này.");
    }

    _handleKeyboardPlay() {
        if (!this.hoveredSegmentId) return;
        
        const item = this.items.find(i => i.id === this.hoveredSegmentId);
        if (!item) return;

        if (item.label.endsWith('-name')) {
            const index = this.items.indexOf(item);
            this._handlePlayRule(index);
        } else {
            if (item.audio && item.audio !== 'skip' && this.playSegmentCallback) {
                this.playSegmentCallback(item.id, item.audio, item.segment);
            }
        }
    }

    highlightSegment(id, shouldScroll = true) {
        if (!this.container) return;
        this.container.querySelectorAll('.segment').forEach(el => el.classList.remove('active'));
        const activeEl = this.container.querySelector(`.segment[data-id="${id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            if (shouldScroll) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    clearHighlight() {
        if (!this.container) return;
        this.container.querySelectorAll('.segment').forEach(el => el.classList.remove('active'));
    }

    getFirstVisibleSegmentId() {
        if (!this.container) return null;
        
        const containerRect = this.container.getBoundingClientRect();
        // Since container scrolls inside window (actually body scrolls, container is flex-1), 
        // segments are in document flow.
        // We want the first segment that is roughly in the viewport.
        
        const segments = this.container.querySelectorAll('.segment');
        
        // Optimization: Use binary search or assume order? 
        // Linear scan is fine for ~1000 items on modern devices, but we can break early.
        // Or checking `elementFromPoint`?
        
        // Let's use elementFromPoint at center or top of viewport
        const x = window.innerWidth / 2;
        const y = 100; // Offset for header + margin
        
        // Or simply loop segments.
        const viewportTop = window.scrollY + 80; // Header height offset
        
        for (const segment of segments) {
            const rect = segment.getBoundingClientRect();
            // rect.top is relative to viewport
            if (rect.top + rect.height > 80 && rect.top < window.innerHeight) {
                // This segment is visible
                // Check if it has audio? Or return ID and let loader decide.
                // Usually we want the one *at the top*, even if partially scrolled out?
                // The user says "segment có mặt trên màn hình hiện tại".
                // If we are reading, we probably want the one near the top.
                if (parseInt(segment.dataset.id)) {
                    return parseInt(segment.dataset.id);
                }
            }
        }
        return null;
    }
}
