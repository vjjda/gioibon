// Path: web/modules/services/sqlite_helper.js
import { Factory } from '@journeyapps/wa-sqlite/src/sqlite-api.js';
import { IDBBatchAtomicVFS } from '@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLiteConstants from '@journeyapps/wa-sqlite/src/sqlite-constants.js';
import { BASE_URL } from 'core/config.js';

// [STRATEGY]
// 1. Trong môi trường Vite (Dev/Build): Dùng ?url để Vite tự quản lý và băm (hash) file.
// 2. Trong môi trường Simple Server: Dùng đường dẫn tĩnh /node_modules/...
// Chúng ta sẽ thử dùng URL constructor chuẩn ES để tương thích cả hai.

const getWasmUrl = () => {
    // Nếu đang chạy trong Vite (có import.meta.env)
    if (import.meta.env) {
        // Dùng URL đặc thù của Vite cho WASM
        return new URL('@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url', import.meta.url).href;
    }
    // Nếu chạy Simple Server (Browser-sync)
    return `${BASE_URL}node_modules/@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm`;
};

const wasmUrl = getWasmUrl();

export async function initSQLite(options) {
    const { path, vfsOptions, readonly, beforeOpen } = await options;
    
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
        db, path, pointer: db, sqlite, sqliteModule, vfs: idbVfs
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
            }
        }
    };
}

async function run(core, sql, params) {
    const { sqlite, db } = core;
    const results = [];
    for await (const stmt of sqlite.statements(db, sql)) {
        if (params) sqlite.bind_collection(stmt, params);
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
