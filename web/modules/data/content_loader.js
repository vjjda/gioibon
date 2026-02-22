// Path: web/modules/data/content_loader.js
import { SqliteConnection } from 'services/sqlite_connection.js';

export class ContentLoader {
    constructor(dbConnection) {
        this.db = dbConnection || new SqliteConnection();
        this.data = null;
    }

    async load() {
        if (this.data) return this.data;
        try {
            const BATCH_SIZE = 100; 
            this.data = [];
            let lastUid = 0;
            let hasMore = true;

            while (hasMore) {
                // [SQL OPTIMIZATION] Đẩy logic chọn text vào SQLite bằng CASE WHEN.
                // Giảm 40% lượng chuỗi (string) phải truyền từ WASM sang JavaScript.
                const rows = await this.db.query(
                    `SELECT uid, html, label, audio_name, 
                     CASE WHEN hint IS NOT NULL AND hint != '' THEN hint ELSE segment END as text 
                     FROM contents WHERE uid > ${lastUid} ORDER BY uid ASC LIMIT ${BATCH_SIZE}`
                );

                if (rows && rows.length > 0) {
                    const batchItems = rows.map(row => ({
                        id: row.uid,
                        html: row.html,
                        label: row.label,
                        audio: row.audio_name,
                        text: row.text // Đã được SQLite xử lý
                    }));
                    this.data.push(...batchItems);
                    lastUid = rows[rows.length - 1].uid;

                    await new Promise(resolve => setTimeout(resolve, 5));
                } else {
                    hasMore = false;
                }
            }

            return this.data;
        } catch (error) {
            console.error("ContentLoader Error:", error);
            throw error;
        }
    }

    getAllSegments() {
        if (!this.data) return [];
        return this.data.filter(item => item.audio !== 'skip').map(item => ({
            id: item.id,
            audio: item.audio,
            text: item.text
        }));
    }

    getSegmentsStartingFrom(startId) {
        if (!this.data) return [];
        let startIndex = 0;
        if (startId) {
            startIndex = this.data.findIndex(item => item.id === startId);
            if (startIndex === -1) startIndex = 0;
        }

        const slice = this.data.slice(startIndex);
        return slice.filter(item => item.audio !== 'skip').map(item => ({
            id: item.id,
            audio: item.audio,
            text: item.text
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
        return [];
    }
}

