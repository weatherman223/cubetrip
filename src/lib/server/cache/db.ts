import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const DB_PATH = process.env.DB_PATH ?? resolve('data', 'cache.db');
const DB_DIR = dirname(DB_PATH);
console.log(`Cache DB: ${DB_PATH}`);

// Bump this when cached data shapes change — old rows become cache misses
const CACHE_SCHEMA_VERSION = 1;

let db: InstanceType<typeof Database>;

function initTable(database: InstanceType<typeof Database>) {
	database.exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		)
	`);
	// Add version column to existing tables (no-op if already present)
	try {
		database.exec('ALTER TABLE cache ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
	} catch {
		// Column already exists
	}
	database.exec('CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)');
}

try {
	mkdirSync(DB_DIR, { recursive: true });
	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	initTable(db);
} catch (err) {
	console.error(`Failed to open cache DB at ${DB_PATH}, falling back to in-memory:`, err);
	db = new Database(':memory:');
	initTable(db);
}

// Clean expired entries hourly
setInterval(() => cleanExpired(), 60 * 60 * 1000);

const stmtGet = db.prepare('SELECT value, expires_at, version FROM cache WHERE key = ?');
const stmtSet = db.prepare(
	'INSERT OR REPLACE INTO cache (key, value, expires_at, version) VALUES (?, ?, ?, ?)'
);
const stmtDeleteByPrefix = db.prepare("DELETE FROM cache WHERE key LIKE ? || '%'");
const stmtClean = db.prepare('DELETE FROM cache WHERE expires_at < ?');

export function getCache<T>(key: string): T | null {
	const row = stmtGet.get(key) as
		| { value: string; expires_at: number; version: number }
		| undefined;
	if (!row) return null;
	if (Date.now() > row.expires_at) return null;
	if (row.version !== CACHE_SCHEMA_VERSION) return null; // stale schema → treat as miss
	return JSON.parse(row.value) as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
	stmtSet.run(key, JSON.stringify(value), Date.now() + ttlMs, CACHE_SCHEMA_VERSION);
}

export function invalidateCache(keyPrefix: string): void {
	stmtDeleteByPrefix.run(keyPrefix);
}

export function cleanExpired(): void {
	stmtClean.run(Date.now());
}
