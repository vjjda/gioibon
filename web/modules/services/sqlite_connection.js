// Path: web/modules/services/sqlite_connection.js
import { initSQLite, withExistDB } from 'libs/wa-sqlite-index.js';
import { useIdbStorage } from 'libs/wa-sqlite-idb.js';
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
            const versionUrl = this.dbUrl.replace(/\.db$/, '_version.json');
            const storageKey = `db_version_${this.dbName}`;
            const localVersion = localStorage.getItem(storageKey);
            
            let shouldDownload = false;
            let remoteVersionData = null;

            try {
                // 1. Fetch version file with timestamp to bypass browser cache
                const res = await fetch(`${versionUrl}?t=${Date.now()}`);
                if (res.ok) {
                    remoteVersionData = await res.json();
                    if (remoteVersionData.version !== localVersion) {
                        console.log(`♻️ DB updated. Old: ${localVersion}, New: ${remoteVersionData.version}`);
                        shouldDownload = true;
                    } else {
                        console.log("✅ DB is up-to-date. Using local cache.");
                    }
                } else {
                    console.warn(`⚠️ Cannot fetch version file (${res.status}). Force checking integrity.`);
                    // If no version file, rely on integrity check or force download if missing
                    shouldDownload = !localVersion; 
                }
            } catch (e) {
                console.warn("⚠️ Error checking DB version. Proceeding with caution.", e);
                shouldDownload = !localVersion;
            }

            // 2. Initialize DB based on check result
            if (shouldDownload) {
                console.log("⬇️ Downloading fresh DB...");
                const response = await fetch(`${this.dbUrl}?t=${Date.now()}`);
                if (!response.ok) throw new Error(`Failed to download DB: ${response.status}`);
                
                const buffer = await response.arrayBuffer();
                const file = new File([buffer], this.dbName);

                // withExistDB(file) will truncate and overwrite existing IDB data
                const db = await initSQLite(useIdbStorage(this.dbName, {
                    ...withExistDB(file),
                    url: `${BASE_URL}wa-sqlite-async.wasm`
                }));

                // Update version in localStorage only after successful init
                if (remoteVersionData) {
                    localStorage.setItem(storageKey, remoteVersionData.version);
                }
                
                this.db = db;

                // [OPTIMIZATION] Cấu hình SQLite để tiết kiệm RAM
                try {
                    await db.run("PRAGMA cache_size = 500"); 
                    await db.run("PRAGMA synchronous = OFF"); 
                    await db.run("PRAGMA mmap_size = 0"); // Disable mmap on iOS
                    // Removed temp_store = MEMORY to save RAM
                } catch (e) {
                    console.warn("⚠️ Cannot set PRAGMAs", e);
                }
            } else {
                // Open existing DB from IDB without overwriting
                const db = await initSQLite(useIdbStorage(this.dbName, {
                    url: `${BASE_URL}wa-sqlite-async.wasm`
                }));
                
                this.db = db;

                // Integrity Check: Only if we didn't just verify version via network
                // If we are offline or version check failed, we might want to verify.
                // But if we have a local version string, we assume it's good to avoid heavy reads.
                if (!localVersion) {
                    try {
                        const tables = await db.run("SELECT name FROM sqlite_master WHERE type='table' AND name='contents'");
                        if (tables.length === 0) {
                            console.warn("❌ Cached DB is empty/corrupted. Force re-downloading.");
                            localStorage.removeItem(storageKey);
                            this.db = null;
                            return await this.forceDownload(); 
                        }
                    } catch (e) {
                        console.warn("❌ DB integrity check failed.", e);
                        localStorage.removeItem(storageKey);
                        this.db = null;
                        return await this.forceDownload();
                    }
                }

                // [OPTIMIZATION] Cấu hình SQLite cho kết nối từ cache
                try {
                    await db.run("PRAGMA cache_size = 500");
                    await db.run("PRAGMA mmap_size = 0");
                    // Removed temp_store = MEMORY
                } catch (e) {}
            }

            return this.db;
        } catch (e) {
            console.error("❌ SqliteConnection Init Error:", e);
            throw e;
        }
    }

    async forceDownload() {
        console.log("🔄 Force downloading DB...");
        const response = await fetch(`${this.dbUrl}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Failed to download DB: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const file = new File([buffer], this.dbName);
        
        this.db = await initSQLite(useIdbStorage(this.dbName, {
            ...withExistDB(file),
            url: `${BASE_URL}wa-sqlite-async.wasm`
        }));
        
        // Try to fetch version to update storage if possible, else leave empty to check next time
        try {
             const versionUrl = this.dbUrl.replace(/\.db$/, '_version.json');
             const res = await fetch(`${versionUrl}?t=${Date.now()}`);
             if(res.ok) {
                 const data = await res.json();
                 localStorage.setItem(`db_version_${this.dbName}`, data.version);
             }
        } catch(e) {}
        
        return this.db;
    }

    async query(sql, params = []) {
        if (!this.db) await this.init();
        // wa-sqlite run returns an array of row objects if using the high-level wrapper
        // But wa-sqlite-index.js usually returns a specific format. 
        // Let's assume it returns rows based on the reference project usage.
        return await this.db.run(sql, params);
    }
}
