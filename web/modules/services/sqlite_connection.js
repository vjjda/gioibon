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
            const versionUrl = this.dbUrl.replace(/\.db$/, '_version.json');
            const storageKey = `db_version_${this.dbName}`;
            const localVersion = localStorage.getItem(storageKey);
            
            let shouldDownload = false;
            let remoteVersionData = null;

            // [FIX] Áp dụng AbortController với thời gian chờ 1.5 giây
            // Tránh trình duyệt bị "treo" khi mạng chập chờn hoặc tắt mạng
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

            try {
                const res = await fetch(`${versionUrl}?t=${Date.now()}`, { 
                    cache: 'no-store',
                    signal: controller.signal // Ép fetch tuân thủ Timeout
                });
                
                clearTimeout(timeoutId); // Xóa timeout nếu thành công sớm
                
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
                clearTimeout(timeoutId); // Dọn dẹp bộ đếm
                console.warn("⚠️ Mạng không ổn định hoặc Offline. Chuyển sang dùng Local DB ngay lập tức.");
                shouldDownload = !localVersion;
            }

            if (shouldDownload) {
                console.log("⬇️ Downloading fresh DB...");
                const response = await fetch(`${this.dbUrl}?t=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Failed to download DB: ${response.status}`);
                
                const buffer = await response.arrayBuffer();
                const file = new File([buffer], this.dbName);
                
                const db = await initSQLite(useIdbStorage(this.dbName, {
                    ...withExistDB(file)
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
                    await db.run("PRAGMA query_only = 1");
                } catch (e) {
                    console.warn("⚠️ Cannot set PRAGMAs", e);
                }
            } else {
                const db = await initSQLite(useIdbStorage(this.dbName));
                
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
                    await db.run("PRAGMA query_only = 1");
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
            ...withExistDB(file)
        }));
        
        try {
             const versionUrl = this.dbUrl.replace(/\.db$/, '_version.json');
             const res = await fetch(`${versionUrl}?t=${Date.now()}`, { cache: 'no-store' });
             if(res.ok) {
                 const data = await res.json();
                 localStorage.setItem(`db_version_${this.dbName}`, data.version);
             }
        } catch(e) {}
        
        try {
            await this.db.run("PRAGMA cache_size = 500");
            await this.db.run("PRAGMA temp_store = MEMORY");
            await this.db.run("PRAGMA mmap_size = 0");
            await this.db.run("PRAGMA query_only = 1");
        } catch (e) {}
        
        return this.db;
    }

    async query(sql, params = []) {
        if (!this.db) await this.init();
        return await this.db.run(sql, params);
    }
}

