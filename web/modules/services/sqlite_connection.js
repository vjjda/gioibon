// Path: web/modules/services/sqlite_connection.js
import { initSQLite, withExistDB } from 'libs/wa-sqlite-index.js';
import { useIdbStorage } from 'libs/wa-sqlite-idb.js';

export class SqliteConnection {
    constructor(dbName = "content.db", dbUrl = "data/content.db") {
        this.dbName = dbName;
        this.dbUrl = dbUrl;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        try {
            console.log(`Initializing SQLite DB: ${this.dbName}`);
            
            // Try to open first to check if it exists and has tables
            // Note: useIdbStorage will return a VFS that persists to IDB
            let db = await initSQLite(useIdbStorage(this.dbName));
            
            // Check if valid by querying tables
            let tables = [];
            try {
                tables = await db.run("SELECT name FROM sqlite_master WHERE type='table' AND name='contents'");
            } catch (e) {
                console.warn("DB check failed, might be empty or corrupted", e);
            }

            // If 'contents' table missing, we download and restore
            if (tables.length === 0) {
                console.log("DB empty or missing 'contents' table. Downloading...");
                await db.close(); // Close the empty one

                const response = await fetch(this.dbUrl);
                if (!response.ok) throw new Error(`Failed to fetch DB: ${response.status}`);
                
                const buffer = await response.arrayBuffer();
                const file = new File([buffer], this.dbName);

                // Re-init with the downloaded file
                db = await initSQLite(useIdbStorage(this.dbName, withExistDB(file)));
                console.log("Database initialized from server file.");
            } else {
                console.log("Database loaded from IndexedDB cache.");
            }

            this.db = db;
            return this.db;
        } catch (e) {
            console.error("SqliteConnection Init Error:", e);
            throw e;
        }
    }

    async query(sql, params = []) {
        if (!this.db) await this.init();
        // wa-sqlite run returns an array of row objects if using the high-level wrapper
        // But wa-sqlite-index.js usually returns a specific format. 
        // Let's assume it returns rows based on the reference project usage.
        return await this.db.run(sql, params);
    }
}
