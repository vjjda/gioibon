// Path: web/modules/data/content_loader.js
import { SqliteConnection } from '../services/sqlite_connection.js';

export class ContentLoader {
    constructor(dbConnection) {
        this.db = dbConnection || new SqliteConnection();
        this.data = null;
    }

    async load() {
        if (this.data) return this.data;

        try {
            // Fetch only text metadata, EXCLUDING audio_blob to save memory
            // Chỉ lấy hint (đã xử lý) và segment (gốc), sau đó sẽ lọc bớt trong map
            const rows = await this.db.query("SELECT uid, html, label, segment, audio_name, hint FROM contents ORDER BY uid ASC");
            
            this.data = rows.map(row => {
                const item = {
                    id: row.uid,
                    html: row.html,
                    label: row.label,
                    audio: row.audio_name,
                    // Ưu tiên dùng hint, nếu không có mới dùng segment
                    text: row.hint || row.segment
                };
                return item;
            });

            return this.data;
        } catch (error) {
            console.error("ContentLoader Error:", error);
            throw error;
        }
    }

    getAllSegments() {
        if (!this.data) return [];
        // Return segments that have audio (not 'skip')
        return this.data.filter(item => item.audio !== 'skip').map(item => ({
            id: item.id,
            audio: item.audio,
            text: item.segment
        }));
    }

    getSegmentsStartingFrom(startId) {
        if (!this.data) return [];
        
        let startIndex = 0;
        if (startId) {
            startIndex = this.data.findIndex(item => item.id === startId);
            if (startIndex === -1) startIndex = 0;
        }

        // Slice from start index to end
        const slice = this.data.slice(startIndex);
        
        // Filter for audio
        return slice.filter(item => item.audio !== 'skip').map(item => ({
            id: item.id,
            audio: item.audio,
            text: item.segment
        }));
    }

    getSegment(id) {
        return this.data?.find(item => item.id === id);
    }
    
    getSegmentsByLabelPrefix(prefix) {
        if (!this.data) return [];
        return this.data.filter(item => item.label.startsWith(prefix));
    }

    getRuleSegments(sectionIndex, startSegmentIndex) {
        // Legacy support if needed, or implement logic for rule sequence
        // Currently ContentRenderer handles rule sequence extraction from flat list
        return [];
    }
}
