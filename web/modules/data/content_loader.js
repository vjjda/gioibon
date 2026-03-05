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
                const rows = await this.db.query(
                    `SELECT uid, html, label, audio_name, segment, segment_html, has_hint, heading_id, rule_id 
                     FROM contents WHERE uid > ${lastUid} ORDER BY uid ASC LIMIT ${BATCH_SIZE}`
                );

                if (rows && rows.length > 0) {
                    const batchItems = rows.map(row => ({
                        id: row.uid,
                        html: row.html,
                        label: row.label,
                        audio: row.audio_name,
                        segment: row.segment,      // Bản thô (để search)
                        text: row.segment_html,    // Bản HTML (để hiển thị)
                        hasHint: row.has_hint === 1,
                        headingId: row.heading_id,
                        ruleId: row.rule_id
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

    async loadHeadings() {
        try {
            const rows = await this.db.query(`SELECT uid, text, level, parent_uid, breadcrumbs FROM headings ORDER BY uid ASC`);
            return rows || [];
        } catch (error) {
            console.error("ContentLoader loadHeadings Error:", error);
            return [];
        }
    }

    async searchSegments(keyword) {
        if (!keyword || keyword.trim() === '') return [];
        try {
            // Using parameterized query or escaping if needed. wa-sqlite supports ? but our wrapper might not natively without an array.
            // Let's use simple string concatenation with replace for safety since this is a local client-side db, but still be careful.
            const safeKeyword = keyword.replace(/'/g, "''");
            const query = `
                SELECT 
                    c.uid as id, 
                    c.segment, 
                    h.breadcrumbs,
                    r.id as rule_id,
                    r.viet as rule_viet,
                    r.pali as rule_pali
                FROM contents c
                LEFT JOIN headings h ON c.heading_id = h.uid
                LEFT JOIN rules r ON c.rule_id = r.id
                WHERE c.segment LIKE '%${safeKeyword}%'
                ORDER BY c.uid ASC
            `;
            const rows = await this.db.query(query);
            return rows || [];
        } catch (error) {
            console.error("Search Error:", error);
            return [];
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

