/**
 * db-sqlite.js — SQLite3 database adapter with mysql2-compatible interface
 * 
 * Drop-in replacement for db.js that uses SQLite instead of MySQL.
 * Same API: query(), execute(), get(), all(), run(), getConnection(), testConnection()
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

function normalizeSql(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  let s = sql;
  // Replace INSERT IGNORE INTO with INSERT OR IGNORE INTO
  s = s.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO');
  
  // Handle DATE_SUB(NOW(), INTERVAL X DAY/MINUTE/etc)
  s = s.replace(/DATE_SUB\s*\(\s*(?:NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "datetime('now', '-$1 days')");
  s = s.replace(/DATE_SUB\s*\(\s*(?:NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\d+)\s+MINUTE\s*\)/gi, "datetime('now', '-$1 minutes')");
  
  // Handle DATE_ADD(NOW(), INTERVAL X DAY/MINUTE/etc)
  s = s.replace(/DATE_ADD\s*\(\s*(?:NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "datetime('now', '+$1 days')");
  s = s.replace(/DATE_ADD\s*\(\s*(?:NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\d+)\s+MINUTE\s*\)/gi, "datetime('now', '+$1 minutes')");

  return s;
}

function getDB() {
  if (_db) return _db;
  
  const dbPath = path.resolve(__dirname, '../../data/roomiematch.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(dbPath, { verbose: console.log });
  
  // Enable foreign keys
  _db.pragma('foreign_keys = ON');

  // Register NOW() function
  _db.function('NOW', () => new Date().toISOString().replace('T', ' ').substring(0, 19));
  
  return _db;
}

/**
 * query — run a SELECT (or any statement that returns rows).
 * Returns an array of plain row objects.
 */
async function query(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(normalizeSql(sql));
  return stmt.all(...params);
}

/**
 * execute — run an INSERT / UPDATE / DELETE.
 * Returns object with insertId, affectedRows (MySQL-compatible format)
 */
async function execute(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(normalizeSql(sql));
  const info = stmt.run(...params);
  
  return {
    insertId: info.lastInsertRowid,
    affectedRows: info.changes,
    fieldCount: 0,
    info: '',
    serverStatus: 2,
    warningStatus: 0
  };
}

/**
 * get — fetch a single row (first result or null).
 */
async function get(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(normalizeSql(sql));
  return stmt.get(...params) || null;
}

/**
 * all — fetch all matching rows.
 */
async function all(sql, params = []) {
  return query(sql, params);
}

/**
 * run — execute a write statement (INSERT / UPDATE / DELETE / CREATE).
 */
async function run(sql, params = []) {
  return execute(sql, params);
}

/**
 * getConnection — returns a mock connection for compatibility
 * SQLite doesn't need connection pooling
 */
async function getConnection() {
  const db = getDB();
  return {
    query: (sql, params) => Promise.resolve([query(sql, params)]),
    execute: (sql, params) => Promise.resolve([execute(sql, params)]),
    release: () => {},
    beginTransaction: () => db.prepare('BEGIN').run(),
    commit: () => db.prepare('COMMIT').run(),
    rollback: () => db.prepare('ROLLBACK').run(),
  };
}

/**
 * testConnection — verify database is accessible
 */
async function testConnection() {
  const db = getDB();
  db.prepare('SELECT 1').get();
  console.log('[DB] SQLite database ready.');
}

module.exports = { query, execute, get, all, run, getConnection, testConnection };
