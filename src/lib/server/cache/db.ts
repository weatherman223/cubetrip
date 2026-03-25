import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const DB_DIR = resolve('data');
const DB_PATH = resolve(DB_DIR, 'cache.db');

let db: InstanceType<typeof Database>;

try {
	mkdirSync(DB_DIR, { recursive: true });
	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			expires_at INTEGER NOT NULL
		)
	`);
	db.exec('CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)');
} catch (err) {
	console.error(`Failed to open cache DB at ${DB_PATH}, falling back to in-memory:`, err);
	db = new Database(':memory:');
	db.exec(`
		CREATE TABLE cache (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			expires_at INTEGER NOT NULL
		)
	`);
	db.exec('CREATE INDEX idx_cache_expires ON cache(expires_at)');
}

// Clean expired entries hourly
setInterval(() => cleanExpired(), 60 * 60 * 1000);

const stmtGet = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?');
const stmtSet = db.prepare(
	'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)'
);
const stmtDeleteByPrefix = db.prepare("DELETE FROM cache WHERE key LIKE ? || '%'");
const stmtClean = db.prepare('DELETE FROM cache WHERE expires_at < ?');

export function getCache<T>(key: string): T | null {
	const row = stmtGet.get(key) as { value: string; expires_at: number } | undefined;
	if (!row) return null;
	if (Date.now() > row.expires_at) return null;
	return JSON.parse(row.value) as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
	stmtSet.run(key, JSON.stringify(value), Date.now() + ttlMs);
}

export function invalidateCache(keyPrefix: string): void {
	stmtDeleteByPrefix.run(keyPrefix);
}

export function cleanExpired(): void {
	stmtClean.run(Date.now());
}
