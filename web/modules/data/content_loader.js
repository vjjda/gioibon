// Path: web/modules/data/content_loader.js
import { SqliteConnection } from '../services/sqlite_connection.js';

export class ContentLoader {
    constructor() {
        this.db = new SqliteConnection();
        this.data = null;
    }

    async load() {
        if (this.data) return this.data;

        try {
            // Fetch all contents ordered by UID
            const rows = await this.db.query("SELECT * FROM contents ORDER BY uid ASC");
            
            // Map rows to a cleaner format if necessary, or use as is.
            // wa-sqlite (via SqliteConnection) returns rows as objects usually.
            // We'll normalize just in case.
            this.data = rows.map(row => ({
                id: row.uid,
                html: row.html,
                label: row.label,
                segment: row.segment,
                audio: row.audio
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
            text: item.segment, // or compiled HTML? Usually TTS needs text.
            audio: item.audio
        }));
    }

    getSegment(id) {
        return this.data?.find(item => item.id === id);
    }
    
    // Helper to find range of segments for a specific rule/group if needed
    getSegmentsByLabelPrefix(prefix) {
        if (!this.data) return [];
        return this.data.filter(item => item.label.startsWith(prefix));
    }
}
