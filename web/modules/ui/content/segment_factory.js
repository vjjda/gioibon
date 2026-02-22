// Path: web/modules/ui/content/segment_factory.js

export class SegmentFactory {
    constructor(callbacks) {
        this.callbacks = callbacks;
        // { playSegment, playSequence, onMaskStart, onMaskEnter, onHover }
    }

    create(item, index) {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'segment';
        segmentEl.dataset.id = item.id;
        segmentEl.dataset.label = item.label;
        segmentEl.dataset.index = index;
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

        if (item.html && item.html.match(/^<h[1-6]/i)) {
            el.classList.add('heading-segment');
        }

        if (item.html && item.html.match(/class=['"](endsection|endvagga|endsutta|sadhu|namo)['"]/)) {
            el.classList.add('end-segment');
        }
    }

    _addPlayButtons(wrapper, item, index) {
        if (item.audio && item.audio !== 'skip') {
            const playBtn = document.createElement('button');
            playBtn.id = `play-btn-${item.id}`;
            playBtn.name = `play-btn-${item.id}`;
            playBtn.className = 'play-btn icon-btn';
            playBtn.innerHTML = '<i class="fas fa-circle"></i>';
            playBtn.title = "Nghe đoạn này";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.callbacks.playSegment) this.callbacks.playSegment(item.id, item.audio, item.segment);
            };
            wrapper.appendChild(playBtn);
        }

        if (item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle') {
            const playSeqBtn = document.createElement('button');
            playSeqBtn.id = `play-seq-btn-${item.id}`;
            playSeqBtn.name = `play-seq-btn-${item.id}`;
            playSeqBtn.className = 'play-btn icon-btn play-sequence-btn';
            playSeqBtn.innerHTML = '<i class="fas fa-play-circle"></i>';
            playSeqBtn.title = "Nghe toàn bộ phần này";
            playSeqBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.callbacks.playSequence) this.callbacks.playSequence(index);
            };
            wrapper.appendChild(playSeqBtn);
        }
    }

    _addTextContent(wrapper, item) {
        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        const htmlTemplate = item.html || '{}';
        
        // Sử dụng thuộc tính 'text' đã được ContentLoader tối ưu (chứa hint hoặc segment)
        const renderedHtml = htmlTemplate.replace('{}', item.text || '');
        
        textEl.innerHTML = renderedHtml;
        wrapper.appendChild(textEl);
    }

    _addMaskToggle(segmentEl, item) {
        // Thay isRuleHeader bằng isHeading (bỏ qua title/subtitle)
        const isHeading = item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
        const hasAudio = item.audio && item.audio !== 'skip';

        if (hasAudio || isHeading) {
            const toggleArea = document.createElement('div');
            toggleArea.className = 'segment-mask-toggle';
            toggleArea.title = "Nhấp để che/hiện text";
            
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

