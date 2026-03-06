// Path: web/modules/services/sqlite_connection.js
import { initSQLite, withExistDB, useIdbStorage } from './sqlite_helper.js';
import { BASE_URL } from 'core/config.js';

export class SqliteConnection {
    constructor(dbName = "content.db", dbUrl = `${BASE_URL}app-content/content.db`) {
        this.dbName = dbName;
        this.dbUrl = dbUrl;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        try {
            console.log("⬇️ Loading DB into RAM (MemoryVFS)...");
            // App dựa vào Service Worker để cache file này, nên cứ fetch bình thường.
            // Nếu có bản cập nhật, SW sẽ trả về file mới.
            const response = await fetch(this.dbUrl);
            if (!response.ok) throw new Error(`Failed to load DB: ${response.status}`);
            
            const buffer = await response.arrayBuffer();
            const file = new File([buffer], this.dbName);
            
            // Khởi tạo DB thẳng vào bộ nhớ
            this.db = await initSQLite(useIdbStorage(this.dbName, {
                ...withExistDB(file)
            }));
            
            try {
                await this.db.run("PRAGMA cache_size = 500");
                await this.db.run("PRAGMA temp_store = MEMORY");
                await this.db.run("PRAGMA synchronous = OFF");
                await this.db.run("PRAGMA mmap_size = 0");
                await this.db.run("PRAGMA query_only = 1");
            } catch (e) {
                console.warn("⚠️ Cannot set PRAGMAs", e);
            }

            return this.db;

        } catch (e) {
            console.error("❌ SqliteConnection Init Error:", e);
            throw e;
        }
    }

    async forceDownload() {
        return this.init(); // MemoryVFS luôn load lại từ đầu, forceDownload = init
    }

    async query(sql, params = []) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}

