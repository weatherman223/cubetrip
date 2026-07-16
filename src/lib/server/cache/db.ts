import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { logger } from '$lib/server/logger';

const DB_PATH = process.env.DB_PATH ?? resolve('data', 'cache.db');
const DB_DIR = dirname(DB_PATH);

export let dbMode: 'file' | 'memory' = 'file';

logger.debug({ path: DB_PATH }, 'cache db path');

// Bump this when cached data shapes change.
// Old rows automatically become cache misses (version check in getCache).
// No manual DB wipe needed — stale entries are ignored and eventually cleaned.
// Expect a brief cache-cold period after bumping as fresh data repopulates.
const CACHE_SCHEMA_VERSION = 1;

let db: InstanceType<typeof Database>;

export function initTable(database: InstanceType<typeof Database>) {
	database.exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		)
	`);

	// Legacy DBs predate the version column — add it if missing.
	// ponytail: single idempotent column check; bring back a user_version
	// migration loop when a second migration actually exists.
	const columns = database.pragma('table_info(cache)') as Array<{ name: string }>;
	if (!columns.some((col) => col.name === 'version')) {
		database.exec('ALTER TABLE cache ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
	}

	database.exec('CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)');
}

try {
	mkdirSync(DB_DIR, { recursive: true });
	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('busy_timeout = 5000');
	initTable(db);
} catch (err) {
	dbMode = 'memory';
	logger.error({ err, path: DB_PATH }, 'failed to open cache db, falling back to in-memory');
	db = new Database(':memory:');
	initTable(db);
}

// Clean expired entries hourly
setInterval(() => cleanExpired(), 60 * 60 * 1000);

const stmtGet = db.prepare('SELECT value, expires_at, version FROM cache WHERE key = ?');
const stmtSet = db.prepare(
	'INSERT OR REPLACE INTO cache (key, value, expires_at, version) VALUES (?, ?, ?, ?)'
);
const stmtDeleteByKey = db.prepare('DELETE FROM cache WHERE key = ?');
const stmtClean = db.prepare('DELETE FROM cache WHERE expires_at < ?');

export function getCache<T>(key: string): T | null {
	const row = stmtGet.get(key) as
		| { value: string; expires_at: number; version: number }
		| undefined;
	if (!row) return null;
	if (Date.now() > row.expires_at) return null;
	if (row.version !== CACHE_SCHEMA_VERSION) return null; // stale schema → treat as miss
	try {
		return JSON.parse(row.value) as T;
	} catch {
		logger.warn({ key }, 'corrupted cache entry, deleting');
		stmtDeleteByKey.run(key);
		return null;
	}
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
	stmtSet.run(key, JSON.stringify(value), Date.now() + ttlMs, CACHE_SCHEMA_VERSION);
}

export function cleanExpired(): void {
	stmtClean.run(Date.now());
}
