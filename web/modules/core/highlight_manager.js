// Path: web/modules/core/highlight_manager.js

export class HighlightManager {
    constructor() {
        this.STORAGE_KEY = 'sutta_user_highlights';
        this.highlights = this._load(); // { [segmentId]: [ { id: 'uuid', start: number, end: number, color: string, text: string } ] }
        this.listeners = [];
    }

    _load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error("Failed to load highlights", e);
            return {};
        }
    }

    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.highlights));
            this._notifyListeners();
        } catch (e) {
            console.error("Failed to save highlights", e);
        }
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    _notifyListeners() {
        this.listeners.forEach(cb => cb());
    }

    getHighlights(segmentId) {
        return this.highlights[segmentId] || [];
    }

    addHighlight(segmentId, startOffset, endOffset, color, text) {
        if (!this.highlights[segmentId]) {
            this.highlights[segmentId] = [];
        }
        
        // Remove overlaps or merge? For simplicity, we just add it and let the renderer handle overlaps (or we can filter here).
        // Let's filter out completely overlapping ones, or just allow adding new ones that might overwrite.
        const newHighlight = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            start: startOffset,
            end: endOffset,
            color: color,
            text: text
        };

        this.highlights[segmentId].push(newHighlight);
        this._save();
        return newHighlight;
    }

    removeHighlight(segmentId, highlightId) {
        if (this.highlights[segmentId]) {
            this.highlights[segmentId] = this.highlights[segmentId].filter(h => h.id !== highlightId);
            if (this.highlights[segmentId].length === 0) {
                delete this.highlights[segmentId];
            }
            this._save();
        }
    }

    clearHighlights(segmentId) {
        if (this.highlights[segmentId]) {
            delete this.highlights[segmentId];
            this._save();
        }
    }

    // Helper: Tính toán offset của window.getSelection() relative to container
    static getSelectionOffsets(selection, container) {
        let startNode = selection.anchorNode;
        let startOffset = selection.anchorOffset;
        let endNode = selection.focusNode;
        let endOffset = selection.focusOffset;

        // Make sure start is before end
        const range = selection.getRangeAt(0);
        // Range already has correct start and end regardless of selection direction
        startNode = range.startContainer;
        startOffset = range.startOffset;
        endNode = range.endContainer;
        endOffset = range.endOffset;

        let currentOffset = 0;
        let finalStart = 0;
        let finalEnd = 0;
        let foundStart = false;
        let foundEnd = false;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while ((node = walker.nextNode())) {
            if (node === startNode) {
                finalStart = currentOffset + startOffset;
                foundStart = true;
            }
            if (node === endNode) {
                finalEnd = currentOffset + endOffset;
                foundEnd = true;
            }
            currentOffset += node.nodeValue.length;

            if (foundStart && foundEnd) break;
        }

        return { start: finalStart, end: finalEnd };
    }

    // Helper: Apply highlights to a DOM element
    static applyHighlightsToElement(element, highlights, onRemoveClick) {
        if (!highlights || highlights.length === 0 || !element) return;

        // 1. Get all text nodes
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        let fullText = '';
        const nodeMap = [];
        for (const n of textNodes) {
            nodeMap.push({
                node: n,
                start: fullText.length,
                length: n.nodeValue.length
            });
            fullText += n.nodeValue;
        }

        // 2. Map highlights to nodes
        const tasksByNode = new Map();

        // Sort highlights by start
        const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

        for (const h of sortedHighlights) {
            const matchStart = h.start;
            const matchEnd = h.end;

            for (const item of nodeMap) {
                const nodeStart = item.start;
                const nodeEnd = item.start + item.length;

                const intersectStart = Math.max(matchStart, nodeStart);
                const intersectEnd = Math.min(matchEnd, nodeEnd);

                if (intersectStart < intersectEnd) {
                    const localStart = intersectStart - nodeStart;
                    const localEnd = intersectEnd - nodeStart;

                    if (!tasksByNode.has(item.node)) {
                        tasksByNode.set(item.node, []);
                    }
                    tasksByNode.get(item.node).push({ 
                        start: localStart, 
                        end: localEnd, 
                        color: h.color,
                        id: h.id
                    });
                }
            }
        }

        // 3. Replace text nodes with Fragments containing <span class="user-highlight">
        for (const [n, ranges] of tasksByNode.entries()) {
            ranges.sort((a, b) => a.start - b.start);

            const fragment = document.createDocumentFragment();
            const textValue = n.nodeValue;
            let lastIndex = 0;

            for (const range of ranges) {
                // If there's overlap, we might skip or just clip. Let's just process sequentially and avoid going backward.
                if (range.start < lastIndex) continue; // Overlap simple prevention

                if (range.start > lastIndex) {
                    fragment.appendChild(document.createTextNode(textValue.substring(lastIndex, range.start)));
                }

                const span = document.createElement('span');
                span.className = `user-highlight color-${range.color}`;
                span.dataset.highlightId = range.id;
                span.textContent = textValue.substring(range.start, range.end);
                
                if (onRemoveClick) {
                    span.addEventListener('click', (e) => {
                        e.stopPropagation(); // Ngăn click bubble up
                        onRemoveClick(range.id);
                    });
                }

                fragment.appendChild(span);
                lastIndex = range.end;
            }

            if (lastIndex < textValue.length) {
                fragment.appendChild(document.createTextNode(textValue.substring(lastIndex)));
            }

            n.parentNode.replaceChild(fragment, n);
        }
    }
}
