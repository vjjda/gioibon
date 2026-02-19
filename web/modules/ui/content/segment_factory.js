// Path: web/modules/ui/content/segment_factory.js

export class SegmentFactory {
    constructor(callbacks) {
        this.callbacks = callbacks; // { playSegment, playRule, onMaskStart, onMaskEnter }
    }

    create(item, index) {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'segment';
        segmentEl.dataset.id = item.id;
        segmentEl.dataset.label = item.label;
        segmentEl.dataset.index = index; 
        
        // Track hover for keyboard shortcut
        segmentEl.addEventListener('mouseenter', () => {
            if (this.callbacks.onHover) this.callbacks.onHover(item.id);
        });

        this._applyClasses(segmentEl, item);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'segment-content-wrapper';

        this._addPlayButtons(contentWrapper, item, index);
        this._addTextContent(contentWrapper, item);

        segmentEl.appendChild(contentWrapper);

        this._addMaskToggle(segmentEl, item);
        
        return segmentEl;
    }

    _applyClasses(el, item) {
        if (item.label.endsWith('-name')) {
            el.classList.add('rule-header');
        } else if (item.label.endsWith('-chapter')) {
            el.classList.add('chapter-header');
        } else if (item.label === 'title') {
            el.classList.add('main-title');
        }

        if (item.html && item.html.match(/class=['"](endsection|endvagga|endsutta|sadhu|namo)['"]/)) {
            el.classList.add('end-segment');
        }
    }

    _addPlayButtons(wrapper, item, index) {
        // Play Segment Button
        if (item.audio && item.audio !== 'skip') {
            const playBtn = document.createElement('button');
            playBtn.className = 'play-btn icon-btn';
            playBtn.innerHTML = '<i class="fas fa-circle"></i>';
            playBtn.title = "Nghe đoạn này";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.callbacks.playSegment) this.callbacks.playSegment(item.id, item.audio, item.segment);
            };
            wrapper.appendChild(playBtn);
        }

        // Play Rule Button
        if (item.label.endsWith('-name')) {
            const playRuleBtn = document.createElement('button');
            playRuleBtn.className = 'play-btn icon-btn play-rule-btn';
            playRuleBtn.innerHTML = '<i class="fas fa-play-circle"></i>';
            playRuleBtn.title = "Nghe toàn bộ điều này";
            playRuleBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.callbacks.playRule) this.callbacks.playRule(index);
            };
            wrapper.appendChild(playRuleBtn);
        }
    }

    _addTextContent(wrapper, item) {
        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        const htmlTemplate = item.html || '{}';
        const renderedHtml = htmlTemplate.replace('{}', item.segment || '');
        textEl.innerHTML = renderedHtml;
        wrapper.appendChild(textEl);
    }

    _addMaskToggle(segmentEl, item) {
        const isRuleHeader = item.label.endsWith('-name');
        const hasAudio = item.audio && item.audio !== 'skip';

        if (hasAudio || isRuleHeader) {
            const toggleArea = document.createElement('div');
            toggleArea.className = 'segment-mask-toggle';
            toggleArea.title = "Nhấp để che/hiện text";
            
            // Delegate events to callbacks (MaskManager)
            if (this.callbacks.onMaskStart) {
                toggleArea.addEventListener('mousedown', (e) => this.callbacks.onMaskStart(e, segmentEl, item));
                toggleArea.addEventListener('touchstart', (e) => this.callbacks.onMaskStart(e, segmentEl, item), { passive: false });
            }
            
            if (this.callbacks.onMaskEnter) {
                toggleArea.addEventListener('mouseenter', (e) => this.callbacks.onMaskEnter(e, segmentEl));
            }
            
            segmentEl.appendChild(toggleArea);
        }
    }
}
