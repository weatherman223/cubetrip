import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The db module has top-level side effects (opens DB, creates table, starts setInterval).
// It uses process.env.DB_PATH (or defaults to data/cache.db).
// We rely on that initialization and use unique keys per test to avoid interference.

import Database from 'better-sqlite3';
import { getCache, setCache, cleanExpired, initTable } from './db';

const BASE_TIME = 1_700_000_000_000; // fixed base for predictable Date.now()

describe('cache db', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: BASE_TIME });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('setCache then getCache returns stored value', () => {
		const key = 'db-test:set-get:' + Date.now();
		setCache(key, { greeting: 'hello' }, 60_000);
		const result = getCache<{ greeting: string }>(key);
		expect(result).toEqual({ greeting: 'hello' });
	});

	it('getCache for non-existent key returns null', () => {
		const key = 'db-test:nonexistent:' + Date.now();
		const result = getCache(key);
		expect(result).toBeNull();
	});

	it('getCache for expired entry returns null', () => {
		const key = 'db-test:expired:' + Date.now();
		setCache(key, 'will-expire', 5_000);

		// Advance time past TTL
		vi.advanceTimersByTime(5_001);

		const result = getCache(key);
		expect(result).toBeNull();
	});

	it('setCache overwrites existing key with new value', () => {
		const key = 'db-test:overwrite:' + Date.now();
		setCache(key, 'first', 60_000);
		setCache(key, 'second', 60_000);

		const result = getCache<string>(key);
		expect(result).toBe('second');
	});

	it('complex nested object round-trips through JSON', () => {
		const key = 'db-test:complex:' + Date.now();
		const complex = {
			name: 'WCA Comp',
			events: ['333', '222', '444'],
			nested: {
				location: { lat: 40.7128, lng: -74.006 },
				meta: null as null,
				count: 0,
				active: false
			},
			tags: [] as string[]
		};
		setCache(key, complex, 60_000);

		const result = getCache<typeof complex>(key);
		expect(result).toEqual(complex);
	});

	it('cleanExpired removes expired entries but keeps valid ones', () => {
		const prefix = 'db-test:clean:' + Date.now();
		// Short-lived entry: 2s TTL
		setCache(`${prefix}:short`, 'short-lived', 2_000);
		// Long-lived entry: 60s TTL
		setCache(`${prefix}:long`, 'long-lived', 60_000);

		// Advance time past the short TTL but before the long TTL
		vi.advanceTimersByTime(3_000);

		cleanExpired();

		// Short entry is gone (expired AND cleaned from DB)
		expect(getCache(`${prefix}:short`)).toBeNull();
		// Long entry still valid
		expect(getCache<string>(`${prefix}:long`)).toBe('long-lived');
	});

	it('getCache returns null and deletes row when JSON is corrupted', () => {
		const key = 'db-test:corrupted:' + Date.now();
		// Insert valid data first, then corrupt it directly in the DB
		setCache(key, { valid: true }, 60_000);

		// Corrupt the value column directly via a new DB connection
		const dbPath = process.env.DB_PATH ?? 'data/cache.db';
		const rawDb = new Database(dbPath);
		rawDb.prepare('UPDATE cache SET value = ? WHERE key = ?').run('{not valid json!!!', key);
		rawDb.close();

		// getCache should return null (cache miss), not throw
		const result = getCache(key);
		expect(result).toBeNull();

		// The corrupted row should be deleted — a second call also returns null
		// and the row should not exist anymore
		setCache(key, { restored: true }, 60_000);
		const restored = getCache<{ restored: boolean }>(key);
		expect(restored).toEqual({ restored: true });
	});

	it('entry at exact expiration boundary is still valid (> not >=)', () => {
		const key = 'db-test:boundary:' + Date.now();
		const ttl = 1_000;
		setCache(key, 'boundary-value', ttl);

		// Advance time to exactly the TTL
		// expires_at = BASE_TIME + ttl, and getCache checks Date.now() > expires_at
		// At exactly BASE_TIME + ttl, Date.now() === expires_at, so > is false => still valid
		vi.advanceTimersByTime(ttl);

		const result = getCache<string>(key);
		expect(result).toBe('boundary-value');
	});
});

describe('initTable', () => {
	it('fresh DB: creates table with version column', () => {
		const testDb = new Database(':memory:');
		initTable(testDb);

		const cols = testDb.pragma('table_info(cache)') as Array<{ name: string }>;
		expect(cols.some((c) => c.name === 'version')).toBe(true);

		testDb.close();
	});

	it('legacy table without version column: column gets added', () => {
		const testDb = new Database(':memory:');
		testDb
			.prepare(
				`
			CREATE TABLE cache (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				expires_at INTEGER NOT NULL
			)
		`
			)
			.run();

		initTable(testDb);

		const cols = testDb.pragma('table_info(cache)') as Array<{ name: string }>;
		expect(cols.some((c) => c.name === 'version')).toBe(true);

		testDb.close();
	});

	it('calling initTable repeatedly is idempotent', () => {
		const testDb = new Database(':memory:');
		initTable(testDb);
		initTable(testDb);
		initTable(testDb);

		// Table should still work
		testDb
			.prepare('INSERT INTO cache (key, value, expires_at, version) VALUES (?, ?, ?, ?)')
			.run('test-key', '"hello"', Date.now() + 60_000, 1);
		const row = testDb.prepare('SELECT value FROM cache WHERE key = ?').get('test-key') as {
			value: string;
		};
		expect(row.value).toBe('"hello"');

		testDb.close();
	});
});
