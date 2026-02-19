// Path: web/modules/ui/content_renderer.js

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        this.items = []; // Store items for index lookups
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
            // Determine grouping logic
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
        
        if (item.label.endsWith('-name')) {
            segmentEl.classList.add('rule-header');
        } else if (item.label.endsWith('-chapter')) {
            segmentEl.classList.add('chapter-header');
        } else if (item.label === 'title') {
            segmentEl.classList.add('main-title');
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'segment-content-wrapper';

        // 1. Play Segment Button (Single Segment)
        if (item.audio && item.audio !== 'skip') {
            const playBtn = document.createElement('button');
            playBtn.className = 'play-btn icon-btn';
            playBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            playBtn.title = "Nghe đoạn này";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.playSegmentCallback) this.playSegmentCallback(item.id, item.audio, item.segment);
            };
            contentWrapper.appendChild(playBtn);
        }

        // 2. Play Rule Button (Sequence) - Only for Rule Headers
        if (item.label.endsWith('-name')) {
            const playRuleBtn = document.createElement('button');
            playRuleBtn.className = 'play-btn icon-btn play-rule-btn';
            playRuleBtn.innerHTML = '<i class="fas fa-play-circle"></i>';
            playRuleBtn.title = "Nghe toàn bộ điều này";
            // Make distinct color/style via CSS
            
            playRuleBtn.onclick = (e) => {
                e.stopPropagation();
                this._handlePlayRule(index);
            };
            contentWrapper.appendChild(playRuleBtn);
        }

        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        
        const htmlTemplate = item.html || '{}';
        const renderedHtml = htmlTemplate.replace('{}', item.segment || '');
        textEl.innerHTML = renderedHtml;

        contentWrapper.appendChild(textEl);
        segmentEl.appendChild(contentWrapper);
        
        return segmentEl;
    }

    _handlePlayRule(startIndex) {
        if (!this.playSequenceCallback) return;

        // Logic: Collect segments starting from startIndex + 1
        // Until we hit the next rule header (-name), chapter start (-chapter), or section end.
        const sequence = [];
        
        // Include the rule header itself if it has audio (unlikely per schema 'skip', but just in case)
        // Actually, usually rule name is 'skip'.
        
        // Start looking from next item
        for (let i = startIndex + 1; i < this.items.length; i++) {
            const item = this.items[i];
            
            // Stop conditions
            if (item.label.endsWith('-name')) break; // Next rule
            if (item.label.endsWith('-chapter')) break; // Next chapter
            if (item.label === 'end') break;
            
            // Add to sequence if it has audio
            if (item.audio && item.audio !== 'skip') {
                sequence.push({
                    id: item.id,
                    audio: item.audio,
                    text: item.segment
                });
            }
        }

        if (sequence.length > 0) {
            this.playSequenceCallback(sequence);
        } else {
            alert("Không có dữ liệu âm thanh cho điều luật này.");
        }
    }

    highlightSegment(id) {
        if (!this.container) return;
        this.container.querySelectorAll('.segment').forEach(el => el.classList.remove('active'));
        const activeEl = this.container.querySelector(`.segment[data-id="${id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    clearHighlight() {
        if (!this.container) return;
        this.container.querySelectorAll('.segment').forEach(el => el.classList.remove('active'));
    }
}
