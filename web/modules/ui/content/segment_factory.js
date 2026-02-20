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
        const renderedHtml = htmlTemplate.replace('{}', item.segment || '');
        textEl.innerHTML = renderedHtml;

        // Xử lý bao bọc phần đuôi các từ cho tính năng Hint Mode
        this._prepareHinting(textEl);

        wrapper.appendChild(textEl);
    }

    _prepareHinting(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const nodesToReplace = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim() !== '') {
                nodesToReplace.push(node);
            }
        }

        // Regex: \p{L} lấy chữ cái đầu, \p{L}+ lấy các chữ cái tiếp theo của một từ. 
        // Flag 'u' hỗ trợ đầy đủ Unicode (ví dụ tiếng Việt có dấu).
        const regex = /(\p{L})(\p{L}+)/gu;

        nodesToReplace.forEach(textNode => {
            const text = textNode.nodeValue;
            if (!regex.test(text)) return;
            
            regex.lastIndex = 0; // Reset index do flag 'g'
            
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                // Thêm phần ký tự không phải chữ (khoảng trắng, dấu câu...) phía trước
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }
                
                // Thêm chữ cái đầu tiên
                fragment.appendChild(document.createTextNode(match[1]));
                
                // Bọc phần còn lại của từ vào thẻ span.hint-tail
                const tailSpan = document.createElement('span');
                tailSpan.className = 'hint-tail';
                tailSpan.textContent = match[2];
                fragment.appendChild(tailSpan);
                
                lastIndex = regex.lastIndex;
            }
            
            // Thêm phần còn lại sau khi khớp hết
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            // Thay thế textNode cũ bằng cấu trúc fragment vừa tạo an toàn
            textNode.parentNode.replaceChild(fragment, textNode);
        });
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

