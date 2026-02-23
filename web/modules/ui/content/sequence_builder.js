// Path: web/modules/ui/content/sequence_builder.js

export class SequenceBuilder {
    static build(items, startIndex) {
        if (!items || startIndex < 0 || startIndex >= items.length) return null;
        
        const startItem = items[startIndex];
        const match = startItem.html ? startItem.html.match(/^<h(\d)>/i) : null;
        if (!match) return null; 

        const startLevel = parseInt(match[1]);
        const sequence = [];

        for (let i = startIndex + 1; i < items.length; i++) {
            const item = items[i];
            if (item.label === 'end') break; 

            const itemMatch = item.html ? item.html.match(/^<h(\d)>/i) : null;
            if (itemMatch) {
                const itemLevel = parseInt(itemMatch[1]);
                if (itemLevel <= startLevel) {
                    break;
                }
            }

            if (item.audio && item.audio !== 'skip') {
                sequence.push({ id: item.id, audio: item.audio, text: item.text });
            }
        }
        
        return { sequence, startId: startItem.id };
    }
}

