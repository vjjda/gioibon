// Path: web/modules/data/content_loader.js

export class ContentLoader {
    constructor(url = 'data/content.json') {
        this.url = url;
        this.data = null;
    }

    async load() {
        if (this.data) return this.data;

        try {
            const response = await fetch(this.url);
            if (!response.ok) throw new Error(`Failed to load content: ${response.status}`);
            this.data = await response.json();
            return this.data;
        } catch (error) {
            console.error("ContentLoader Error:", error);
            throw error;
        }
    }

    getSection(index) {
        return this.data?.sections[index];
    }

    getAllSegments() {
        if (!this.data) return [];
        const all = [];
        this.data.sections.forEach(section => {
            section.segments.forEach(seg => {
                all.push({ id: seg.id, text: seg.text });
            });
        });
        return all;
    }

    getRuleSegments(sectionIndex, startSegmentIndex) {
        if (!this.data) return [];
        const section = this.data.sections[sectionIndex];
        const segments = [];
        
        for (let i = startSegmentIndex; i < section.segments.length; i++) {
            const seg = section.segments[i];
            if (i > startSegmentIndex && seg.is_rule_start) break;
            segments.push({ id: seg.id, text: seg.text });
        }
        return segments;
    }
}
