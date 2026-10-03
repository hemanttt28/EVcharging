// ============================================================================
// DATABASE CONNECTION & MANAGEMENT MODULE (node:sqlite)
// ============================================================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ev_charging.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db = null;
const queryLogs = [];
const MAX_LOGS = 50;

/**
 * Log an executed SQL query with timestamp and duration
 */
function logQuery(sql, params = [], durationMs = 0, status = 'SUCCESS', rowCount = 0) {
    queryLogs.unshift({
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toLocaleTimeString(),
        sql: sql.trim(),
        params,
        durationMs: Math.round(durationMs * 100) / 100,
        status,
        rowCount
    });
    if (queryLogs.length > MAX_LOGS) {
        queryLogs.pop();
    }
}

/**
 * Get DB instance or initialize if needed
 */
function getDb() {
    if (!db) {
        initDb();
    }
    return db;
}

/**
 * Initialize or re-create SQLite database
 */
function initDb(forceReset = false) {
    const exists = fs.existsSync(DB_PATH);

    if (forceReset && exists) {
        if (db) {
            try { db.close(); } catch (e) { /* ignore */ }
            db = null;
        }
        try { fs.unlinkSync(DB_PATH); } catch (e) { /* ignore */ }
    }

    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

    // If new or reset, run schema and seed
    if (forceReset || !exists) {
        console.log('[DBMS] Initializing database schema and seed data...');
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schemaSql);

        const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
        db.exec(seedSql);
        console.log('[DBMS] Database setup complete with realistic EV network data.');
        logQuery('DATABASE_INITIALIZED', [], 0, 'SETUP', 0);
    }

    return db;
}

/**
 * Execute SELECT query and return all matching rows
 */
function queryAll(sql, params = []) {
    const start = performance.now();
    try {
        const stmt = getDb().prepare(sql);
        const rows = stmt.all(...params);
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'SUCCESS', rows.length);
        return rows;
    } catch (err) {
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'ERROR: ' + err.message, 0);
        throw err;
    }
}

/**
 * Execute SELECT query and return first matching row
 */
function queryGet(sql, params = []) {
    const start = performance.now();
    try {
        const stmt = getDb().prepare(sql);
        const row = stmt.get(...params);
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'SUCCESS', row ? 1 : 0);
        return row;
    } catch (err) {
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'ERROR: ' + err.message, 0);
        throw err;
    }
}

/**
 * Execute INSERT, UPDATE, DELETE query
 */
function queryRun(sql, params = []) {
    const start = performance.now();
    try {
        const stmt = getDb().prepare(sql);
        const result = stmt.run(...params);
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'SUCCESS', result.changes);
        return result;
    } catch (err) {
        const duration = performance.now() - start;
        logQuery(sql, params, duration, 'ERROR: ' + err.message, 0);
        throw err;
    }
}

/**
 * Execute raw multi-statement SQL script
 */
function execScript(sql) {
    const start = performance.now();
    try {
        getDb().exec(sql);
        const duration = performance.now() - start;
        logQuery(sql, [], duration, 'SUCCESS', 1);
        return { success: true, durationMs: duration };
    } catch (err) {
        const duration = performance.now() - start;
        logQuery(sql, [], duration, 'ERROR: ' + err.message, 0);
        throw err;
    }
}

/**
 * Introspect database schema (Tables, Columns, Keys, Views, Triggers, Row Counts)
 */
function getSchemaMetadata() {
    const tables = queryAll(`
        SELECT name, type 
        FROM sqlite_master 
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY type, name;
    `);

    const result = {
        tables: [],
        views: [],
        triggers: []
    };

    for (const t of tables) {
        const cols = queryAll(`PRAGMA table_info("${t.name}");`);
        const fks = queryAll(`PRAGMA foreign_key_list("${t.name}");`);
        
        let rowCount = 0;
        try {
            const countRow = queryGet(`SELECT COUNT(*) AS c FROM "${t.name}";`);
            rowCount = countRow ? countRow.c : 0;
        } catch (e) {
            rowCount = 0;
        }

        const tableObj = {
            name: t.name,
            type: t.type,
            rowCount,
            columns: cols.map(c => ({
                cid: c.cid,
                name: c.name,
                type: c.type,
                notNull: c.notnull === 1,
                defaultValue: c.dflt_value,
                isPrimaryKey: c.pk > 0
            })),
            foreignKeys: fks.map(f => ({
                from: f.from,
                toTable: f.table,
                toColumn: f.to
            }))
        };

        if (t.type === 'view') {
            result.views.push(tableObj);
        } else {
            result.tables.push(tableObj);
        }
    }

    const triggers = queryAll(`
        SELECT name, tbl_name, sql 
        FROM sqlite_master 
        WHERE type = 'trigger';
    `);
    result.triggers = triggers;

    return result;
}

module.exports = {
    DB_PATH,
    initDb,
    queryAll,
    queryGet,
    queryRun,
    execScript,
    getSchemaMetadata,
    getQueryLogs: () => queryLogs
};
