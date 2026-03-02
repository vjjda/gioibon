// Path: web/modules/ui/content/segment_factory.js

export class SegmentFactory {
    constructor(callbacks, memorizationManager) {
        this.callbacks = callbacks;
        this.memorizationManager = memorizationManager;
        // { playSegment, playSequence, onMaskStart, onMaskEnter, onHover, applySavedState }
    }

    applySavedState(segmentEl, id) {
        if (this.callbacks.applySavedState) {
            this.callbacks.applySavedState(segmentEl, id);
        }
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
        const textEl = this._addTextContent(contentWrapper, item);

        const isHeading = item.html && item.html.match(/^<h[1-6]/i) && item.label !== 'title' && item.label !== 'subtitle';
        if (isHeading && this.callbacks.onHeadingClick) {
            textEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.callbacks.onHeadingClick(item.id);
            });
            textEl.title = "Nhấp để thu gọn/mở rộng";
        }

        if (item.label.endsWith('-name') || isHeading) {
            // Check if HTML explicitly centers it OR if it's an h1/h2/h3 which are implicitly centered via CSS
            const explicitCenter = item.html && (item.html.includes('class="center"') || item.html.includes("class='center'") || item.html.includes('style="text-align: center"') || item.html.includes("style='text-align: center'"));
            const implicitCenter = item.html && item.html.match(/^<h[1-3]/i);
            const isCentered = explicitCenter || implicitCenter;
            
            const memLabel = item.label.endsWith('-name') ? item.label : `heading-${item.id}`;
            this._addMemorizationUI(textEl, item, isCentered, memLabel);
        }

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
                if (this.callbacks.playSegment) this.callbacks.playSegment(item.id, item.audio, item.text);
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
        return textEl;
    }

    _addMemorizationUI(wrapper, item, isCentered = false, memLabel = null) {
        if (!this.memorizationManager) return;

        const actualLabel = memLabel || item.label;

        const memContainer = document.createElement('div');
        memContainer.className = 'memorization-container';
        if (isCentered) {
            memContainer.classList.add('centered');
        }
        memContainer.dataset.label = actualLabel;

        const currentLevel = this.memorizationManager.getLevel(actualLabel);

        const dots = [];
        for (let i = 1; i <= 5; i++) {
            const dot = document.createElement('button');
            dot.className = `mem-dot mem-level-${i}`;
            dot.dataset.level = i;
            if (i <= currentLevel) {
                dot.classList.add('active');
                dot.dataset.activeLevel = currentLevel; 
            }
            dot.onclick = (e) => {
                e.stopPropagation();
                this.memorizationManager.setLevel(actualLabel, i);
            };
            
            dot.onmouseenter = () => {
                dots.forEach((d, idx) => {
                    if (idx < i) {
                        d.classList.add('hover-active');
                        d.dataset.hoverLevel = i;
                    } else {
                        d.classList.add('hover-inactive');
                    }
                });
            };
            
            dot.onmouseleave = () => {
                dots.forEach(d => {
                    d.classList.remove('hover-active', 'hover-inactive');
                    delete d.dataset.hoverLevel;
                });
            };

            dots.push(dot);
            memContainer.appendChild(dot);
        }

        const resetBtn = document.createElement('button');
        resetBtn.className = 'mem-reset-dot';
        resetBtn.title = "Reset tiến độ";
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            this.memorizationManager.setLevel(actualLabel, 0);
        };
        memContainer.appendChild(resetBtn);

        resetBtn.onmouseenter = () => {
            dots.forEach(d => d.classList.add('hover-inactive'));
        };
        resetBtn.onmouseleave = () => {
            dots.forEach(d => d.classList.remove('hover-inactive'));
        };

        wrapper.appendChild(memContainer);
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

