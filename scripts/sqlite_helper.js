#!/usr/bin/env node
/**
 * SQLite Helper - Shared Workspace Utility Module
 * Location: /Users/tuoaoa/Tuoaoa/devflow/shared/sqlite_helper.js
 * 
 * SQLite-first pattern: Uses native SQLite3 for local-first data persistence
 * before considering any cloud/distributed database alternatives.
 * 
 * Local-first architecture: All data operations happen locally first,
 * with optional sync to remote services only when needed.
 * 
 * Why local SQLite-first is preferred for lightweight VPS deployments:
 * - Extremely resource-efficient: Runs entirely in-process, eliminating external database hosting cost and connection pools.
 * - Zero network latency: All database lookups and writes are local, yielding fast and predictable performance.
 * - Minimal RAM and CPU foot-print: Perfectly suited for resource-constrained, single-instance Virtual Private Servers.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. Connection Lifecycle Management
const activeConnections = new Set();

// 2. Centralized Retry Policies
const RETRY_POLICY = {
    retries: 5,
    initialDelay: 50,
    maxDelay: 1000
};

function setRetryPolicy(policy) {
    Object.assign(RETRY_POLICY, policy);
}

// 3. Query Timing Metrics
const queryMetrics = [];
let metricsEnabled = false;

function enableMetrics(enabled = true) {
    metricsEnabled = enabled;
}

function getMetrics() {
    return queryMetrics;
}

function clearMetrics() {
    queryMetrics.length = 0;
}

// 4. Transaction Rollback Tracing
const rollbackTraces = [];

function getRollbackTraces() {
    return rollbackTraces;
}

// 5. Nested Transaction Depth Tracking
const transactionDepths = new WeakMap();

function getTransactionDepth(db) {
    if (!transactionDepths.has(db)) {
        transactionDepths.set(db, 0);
    }
    return transactionDepths.get(db);
}

function incrementTransactionDepth(db) {
    const depth = getTransactionDepth(db);
    transactionDepths.set(db, depth + 1);
    return depth + 1;
}

function decrementTransactionDepth(db) {
    const depth = getTransactionDepth(db);
    transactionDepths.set(db, Math.max(0, depth - 1));
    return Math.max(0, depth - 1);
}

/**
 * Helper to retry database operations when encountering SQLITE_BUSY
 */
async function retryOnBusy(fn) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            if ((err.code === 'SQLITE_BUSY' || err.message.includes('SQLITE_BUSY')) && attempt < RETRY_POLICY.retries) {
                attempt++;
                const delay = Math.min(RETRY_POLICY.initialDelay * Math.pow(2, attempt), RETRY_POLICY.maxDelay);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
}

/**
 * Core query execution wrapper measuring metrics and supporting native drivers
 */
async function executeQuery(db, method, sql, params = []) {
    const start = process.hrtime.bigint();
    try {
        const result = await new Promise((resolve, reject) => {
            db[method](sql, params, function(err, rows) {
                if (err) {
                    reject(err);
                    return;
                }
                if (method === 'run') {
                    resolve({ changes: this.changes, lastID: this.lastID });
                } else {
                    resolve(rows || []);
                }
            });
        });

        if (metricsEnabled) {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1e6;
            queryMetrics.push({ sql, method, durationMs, timestamp: Date.now() });
        }
        return result;
    } catch (err) {
        throw new Error(`SQL error: ${err.message}`);
    }
}

/**
 * Create or open a SQLite database connection
 */
function createDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(new Error(`Failed to create database: ${err.message}`));
                return;
            }
            // Enable WAL mode for high concurrency
            db.run('PRAGMA journal_mode=WAL', (pragmaErr) => {
                if (pragmaErr) console.error('Failed to enable WAL mode:', pragmaErr);
            });
            activeConnections.add(db);
            resolve(db);
        });
    });
}

/**
 * Close a database connection
 */
function close(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(new Error(`Failed to close database: ${err.message}`));
                return;
            }
            activeConnections.delete(db);
            resolve();
        });
    });
}

/**
 * Close all active database connections
 */
function closeAllConnections() {
    const promises = Array.from(activeConnections).map(db => close(db));
    return Promise.all(promises);
}

/**
 * Execute a SQL statement with parameters (retries on SQLITE_BUSY)
 */
function run(db, sql, params = []) {
    return retryOnBusy(() => executeQuery(db, 'run', sql, params));
}

/**
 * Execute a SELECT query and return all rows (retries on SQLITE_BUSY)
 */
function all(db, sql, params = []) {
    return retryOnBusy(() => executeQuery(db, 'all', sql, params));
}

/**
 * Execute a SELECT query and return a single row (retries on SQLITE_BUSY)
 */
function get(db, sql, params = []) {
    return retryOnBusy(() => executeQuery(db, 'get', sql, params));
}

/**
 * Execute transactions supporting nested SAVEPOINTS (retries on SQLITE_BUSY)
 */
function executeTransaction(db, callback) {
    return retryOnBusy(async () => {
        const depth = getTransactionDepth(db);
        const savepointName = `sp_${depth}`;

        if (depth === 0) {
            incrementTransactionDepth(db);
            await new Promise((resolve, reject) => {
                db.run('BEGIN IMMEDIATE TRANSACTION', (err) => err ? reject(err) : resolve());
            });
        } else {
            incrementTransactionDepth(db);
            await new Promise((resolve, reject) => {
                db.run(`SAVEPOINT ${savepointName}`, (err) => err ? reject(err) : resolve());
            });
        }

        try {
            const tx = {
                run: (sql, params = []) => executeQuery(db, 'run', sql, params),
                get: (sql, params = []) => executeQuery(db, 'get', sql, params),
                all: (sql, params = []) => executeQuery(db, 'all', sql, params)
            };
            const result = await callback(tx);

            if (depth === 0) {
                await new Promise((resolve, reject) => {
                    db.run('COMMIT', (err) => err ? reject(err) : resolve());
                });
            } else {
                await new Promise((resolve, reject) => {
                    db.run(`RELEASE SAVEPOINT ${savepointName}`, (err) => err ? reject(err) : resolve());
                });
            }
            decrementTransactionDepth(db);
            return result;
        } catch (err) {
            const trace = {
                timestamp: Date.now(),
                depth,
                savepoint: depth > 0 ? savepointName : null,
                error: err.message,
                stack: err.stack
            };
            rollbackTraces.push(trace);
            console.warn(`[Transaction Rollback Trace] depth=${depth}, savepoint=${trace.savepoint}, error=${err.message}`);

            if (depth === 0) {
                await new Promise((resolve) => db.run('ROLLBACK', () => resolve()));
            } else {
                await new Promise((resolve) => db.run(`ROLLBACK TO SAVEPOINT ${savepointName}`, () => resolve()));
            }
            decrementTransactionDepth(db);
            throw err;
        }
    });
}

/**
 * Backward compatible multiple query transaction helper
 */
function transaction(db, sqlStatements) {
    return executeTransaction(db, async (tx) => {
        for (const statement of sqlStatements) {
            await tx.run(statement);
        }
    });
}

/**
 * Create a table if it doesn't exist
 */
function createTableIfNotExists(db, tableName, createSql) {
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} ${createSql}`;
    return run(db, sql);
}

/**
 * Create an index if it doesn't exist
 */
function createIndexIfNotExists(db, indexName, tableName, columns) {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${cols})`;
    return run(db, sql);
}

module.exports = {
    createDatabase,
    run,
    all,
    get,
    transaction,
    executeTransaction,
    close,
    closeAllConnections,
    createTableIfNotExists,
    createIndexIfNotExists,
    setRetryPolicy,
    enableMetrics,
    getMetrics,
    clearMetrics,
    getRollbackTraces
};
