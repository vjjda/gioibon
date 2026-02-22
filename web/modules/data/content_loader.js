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
            // [FIX iOS] Giảm BATCH_SIZE xuống để tránh cấp phát mảng quá lớn trong 1 tick
            const BATCH_SIZE = 100; 
            this.data = [];
            let lastUid = 0;
            let hasMore = true;

            while (hasMore) {
                // [FIX iOS] Dùng WHERE uid > lastUid thay vì OFFSET.
                // Việc dùng OFFSET bắt buộc SQLite phải đọc quét qua các hàng (chứa audio_blob khổng lồ)
                // từ đầu để đếm, gây tràn RAM (OOM) trên iOS.
                const rows = await this.db.query(
                    `SELECT uid, html, label, segment, audio_name, hint FROM contents WHERE uid > ${lastUid} ORDER BY uid ASC LIMIT ${BATCH_SIZE}`
                );

                if (rows && rows.length > 0) {
                    const batchItems = rows.map(row => ({
                        id: row.uid,
                        html: row.html,
                        label: row.label,
                        audio: row.audio_name,
                        // Ưu tiên dùng hint, nếu không có mới dùng segment
                        text: row.hint || row.segment
                    }));
                    this.data.push(...batchItems);
                    lastUid = rows[rows.length - 1].uid; // Lưu lại UID cuối cùng để chạy tiếp

                    // [FIX iOS] Ép JS nhường luồng (yield) một chút xíu để Garbage Collector dọn dẹp RAM
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
        // Return segments that have audio (not 'skip')
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

        // Slice from start index to end
        const slice = this.data.slice(startIndex);
        // Filter for audio
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
        // Legacy support if needed, or implement logic for rule sequence
        // Currently ContentRenderer handles rule sequence extraction from flat list
        return [];
    }
}