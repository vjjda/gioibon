// Path: web/modules/ui/content_renderer.js

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playRuleCallback) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playRuleCallback = playRuleCallback;
    }

    render(sections) {
        if (!this.container) return;
        this.container.innerHTML = '';
        
        if (!sections || sections.length === 0) {
            this.container.innerHTML = '<div class="empty">Không có dữ liệu hiển thị.</div>';
            return;
        }

        sections.forEach((section, index) => {
            const sectionEl = this._createSection(section, index);
            this.container.appendChild(sectionEl);
        });
    }

    _createSection(section, index) {
        const sectionId = `section-${index}`;
        const sectionEl = document.createElement('section');
        sectionEl.className = 'section';
        if (section.level === 3) {
            sectionEl.classList.add('rule-section');
        }
        sectionEl.id = sectionId;

        const headerEl = document.createElement('div');
        headerEl.className = 'section-header';
        
        let headingTag = 'h2';
        if (section.level === 2) headingTag = 'h3';
        if (section.level === 3) headingTag = 'h3'; // Treat rule heading as H3 per request
        
        const titleEl = document.createElement(headingTag);
        titleEl.className = 'section-title';
        
        if (section.level === 3) {
            titleEl.textContent = `Điều ${section.heading}`;
            titleEl.classList.add('rule-title');
        } else {
            titleEl.textContent = section.heading;
        }
        
        headerEl.appendChild(titleEl);
        sectionEl.appendChild(headerEl);

        section.segments.forEach((segment, segmentIndex) => {
            const segmentEl = this._createSegment(segment, sectionId, index, segmentIndex);
            sectionEl.appendChild(segmentEl);
        });

        return sectionEl;
    }

    _createSegment(segment, sectionId, sectionIndex, segmentIndex) {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'rule-segment';
        segmentEl.dataset.id = segment.id;
        
        // Use unique ID based on segment ID to avoid conflicts if needed, or stick to pattern
        if (segment.is_rule_start && segment.rule_label) {
            // This logic might be redundant if we rely on section structure, but keep for compatibility
            segmentEl.id = `rule-${sectionId}-${segment.rule_label}`;
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'segment-content';

        const playBtn = document.createElement('button');
        playBtn.className = 'play-segment-btn icon-btn';
        playBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        
        // Determine if this is a rule start segment
        // In our new structure, the first segment of a Level 3 section is the rule start.
        // The converter sets is_rule_start=True for it.
        
        if (segment.is_rule_start) {
            playBtn.title = "Nghe toàn bộ điều này";
            playBtn.classList.add('rule-play-btn');
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.playRuleCallback) this.playRuleCallback(sectionIndex, segmentIndex);
            };
        } else {
            playBtn.title = "Nghe đoạn này";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.playSegmentCallback) this.playSegmentCallback(segment.id, segment.text);
            };
        }

        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        textEl.innerHTML = segment.html;

        contentWrapper.appendChild(playBtn);
        contentWrapper.appendChild(textEl);
        segmentEl.appendChild(contentWrapper);
        
        return segmentEl;
    }

    highlightSegment(id) {
        if (!this.container) return;
        this.container.querySelectorAll('.rule-segment').forEach(el => el.classList.remove('active'));
        const activeEl = this.container.querySelector(`.rule-segment[data-id="${id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    clearHighlight() {
        if (!this.container) return;
        this.container.querySelectorAll('.rule-segment').forEach(el => el.classList.remove('active'));
    }
}
