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
                // [PWA OFFLINE FIX] Thêm cache: 'no-store' để trình duyệt bỏ qua mọi bộ nhớ đệm, luôn check Server thật
                const res = await fetch(`${versionUrl}?t=${Date.now()}`, { cache: 'no-store' });
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
                    shouldDownload = !localVersion;
                }
            } catch (e) {
                console.warn("⚠️ Error checking DB version (Likely offline). Proceeding with local DB.", e);
                shouldDownload = !localVersion;
            }

            if (shouldDownload) {
                console.log("⬇️ Downloading fresh DB...");
                // [PWA OFFLINE FIX] Ép tải DB mới không qua cache
                const response = await fetch(`${this.dbUrl}?t=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Failed to download DB: ${response.status}`);
                
                const buffer = await response.arrayBuffer();
                const file = new File([buffer], this.dbName);

                const db = await initSQLite(useIdbStorage(this.dbName, {
                    ...withExistDB(file),
                    url: `${BASE_URL}wa-sqlite-async.wasm`
                }));
                if (remoteVersionData) {
                    localStorage.setItem(storageKey, remoteVersionData.version);
                }
                
                this.db = db;
                try {
                    await db.run("PRAGMA cache_size = 500"); 
                    await db.run("PRAGMA temp_store = MEMORY");
                    await db.run("PRAGMA synchronous = OFF");
                    await db.run("PRAGMA mmap_size = 0");
                } catch (e) {
                    console.warn("⚠️ Cannot set PRAGMAs", e);
                }
            } else {
                const db = await initSQLite(useIdbStorage(this.dbName, {
                    url: `${BASE_URL}wa-sqlite-async.wasm`
                }));
                try {
                    const tables = await db.run("SELECT name FROM sqlite_master WHERE type='table' AND name='contents'");
                    if (tables.length === 0) {
                        console.warn("❌ Cached DB is empty/corrupted. Force re-downloading.");
                        localStorage.removeItem(storageKey);
                        this.db = null;
                        return await this.forceDownload(); 
                    }

                    await db.run("PRAGMA cache_size = 500");
                    await db.run("PRAGMA temp_store = MEMORY");
                    await db.run("PRAGMA mmap_size = 0");
                } catch (e) {
                    console.warn("❌ DB integrity check failed.", e);
                    localStorage.removeItem(storageKey);
                    this.db = null;
                    return await this.forceDownload();
                }
                
                this.db = db;
            }

            return this.db;
        } catch (e) {
            console.error("❌ SqliteConnection Init Error:", e);
            throw e;
        }
    }

    async forceDownload() {
        console.log("🔄 Force downloading DB...");
        const response = await fetch(`${this.dbUrl}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to download DB: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const file = new File([buffer], this.dbName);
        
        this.db = await initSQLite(useIdbStorage(this.dbName, {
            ...withExistDB(file),
            url: `${BASE_URL}wa-sqlite-async.wasm`
        }));
        try {
             const versionUrl = this.dbUrl.replace(/\.db$/, '_version.json');
             const res = await fetch(`${versionUrl}?t=${Date.now()}`, { cache: 'no-store' });
             if(res.ok) {
                 const data = await res.json();
                 localStorage.setItem(`db_version_${this.dbName}`, data.version);
             }
        } catch(e) {}
        
        return this.db;
    }

    async query(sql, params = []) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}

