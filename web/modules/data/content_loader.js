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
            // Fetch all contents ordered by UID
            const rows = await this.db.query("SELECT * FROM contents ORDER BY uid ASC");
            
            // Map rows to a cleaner format if necessary, or use as is.
            this.data = rows.map(row => ({
                id: row.uid,
                html: row.html,
                label: row.label,
                segment: row.segment,
                audio: row.audio_name // Map từ cột audio_name trong DB
            }));

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
