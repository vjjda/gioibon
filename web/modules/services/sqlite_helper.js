// Path: web/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { IDBBatchAtomicVFS } from '@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';
import { BASE_URL } from 'core/config.js';

// [FIX] Xác định đường dẫn WASM từ thư mục /libs/ trong /public/
// Vì tệp này trong thư mục public, nó sẽ được Vite/Simple Server phục vụ tại root của app.
const wasmUrl = `${BASE_URL}libs/wa-sqlite/wa-sqlite-async.wasm`;

export async function initSQLite(options) {
    const { path, vfsOptions, readonly, beforeOpen } = await options;
    
    // Khởi tạo Emscripten module
    const sqliteModule = await SQLiteESMFactory({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) return wasmUrl;
            return file;
        }
    });

    const sqlite = Factory(sqliteModule);
    
    const idbVfs = await IDBBatchAtomicVFS.create(path, sqliteModule, vfsOptions);
    sqlite.vfs_register(idbVfs, true); 

    if (beforeOpen) {
        await beforeOpen(sqlite, idbVfs, path);
    }

    const db = await sqlite.open_v2(
        path,
        readonly ? SQLiteConstants.SQLITE_OPEN_READONLY : (SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_CREATE),
        idbVfs.name
    );

    const core = {
        db,
        path,
        pointer: db,
        sqlite,
        sqliteModule,
        vfs: idbVfs
    };

    return {
        ...core,
        run: (sql, params) => run(core, sql, params),
        close: () => sqlite.close(db)
    };
}

export function withExistDB(file) {
    return {
        beforeOpen: async (sqlite, idbVfs, dbPath) => {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);

            const fileId = 12345; 
            const pOutFlags = new DataView(new ArrayBuffer(4));
            
            const openResult = await idbVfs.jOpen(dbPath, fileId, SQLiteConstants.SQLITE_OPEN_CREATE | SQLiteConstants.SQLITE_OPEN_READWRITE | SQLiteConstants.SQLITE_OPEN_MAIN_DB, pOutFlags);
            
            if (openResult === SQLiteConstants.SQLITE_OK) {
                await idbVfs.jTruncate(fileId, 0);
                await idbVfs.jWrite(fileId, data, 0);
                await idbVfs.jClose(fileId);
                console.log("✅ Database imported successfully via VFS Direct Write.");
            } else {
                console.error("❌ Failed to open VFS file for import", openResult);
            }
        }
    };
}

async function run(core, sql, params) {
    const { sqlite, db } = core;
    const results = [];
    
    for await (const stmt of sqlite.statements(db, sql)) {
        if (params) {
            sqlite.bind_collection(stmt, params);
        }
        
        const cols = sqlite.column_names(stmt);
        while (await sqlite.step(stmt) === SQLiteConstants.SQLITE_ROW) {
            const row = sqlite.row(stmt);
            results.push(Object.fromEntries(cols.map((key, i) => [key, row[i]])));
        }
    }
    return results;
}

export function useIdbStorage(dbName, options = {}) {
    const idbName = dbName.endsWith('.db') ? dbName : `${dbName}.db`;
    return {
        path: idbName,
        vfsOptions: { idbName, ...options },
        ...options
    };
}
