import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The db module has top-level side effects (opens DB, creates table, starts setInterval).
// It uses process.env.DB_PATH (or defaults to data/cache.db).
// We rely on that initialization and use unique keys per test to avoid interference.

import Database from 'better-sqlite3';
import { getCache, setCache, invalidateCache, cleanExpired, initTable } from './db';

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

	it('invalidateCache removes all keys with matching prefix', () => {
		const prefix = 'db-test:inv-prefix:' + Date.now();
		setCache(`${prefix}:flights:A:B`, 'flight1', 60_000);
		setCache(`${prefix}:flights:A:C`, 'flight2', 60_000);
		setCache(`${prefix}:comps:X`, 'comp1', 60_000);

		invalidateCache(`${prefix}:flights`);

		expect(getCache(`${prefix}:flights:A:B`)).toBeNull();
		expect(getCache(`${prefix}:flights:A:C`)).toBeNull();
		expect(getCache<string>(`${prefix}:comps:X`)).toBe('comp1');
	});

	it('invalidateCache does not remove non-matching keys', () => {
		const prefix = 'db-test:inv-nomatch:' + Date.now();
		setCache(`${prefix}:alpha`, 'a', 60_000);
		setCache(`${prefix}:beta`, 'b', 60_000);

		invalidateCache(`${prefix}:gamma`);

		expect(getCache<string>(`${prefix}:alpha`)).toBe('a');
		expect(getCache<string>(`${prefix}:beta`)).toBe('b');
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

describe('initTable migrations', () => {
	it('fresh DB: creates table, runs migrations, sets user_version', () => {
		const testDb = new Database(':memory:');
		initTable(testDb);

		const version = testDb.pragma('user_version', { simple: true });
		expect(version).toBe(1);

		const cols = testDb.pragma('table_info(cache)') as Array<{ name: string }>;
		expect(cols.some((c) => c.name === 'version')).toBe(true);

		testDb.close();
	});

	it('DB already at current version: no migrations run', () => {
		const testDb = new Database(':memory:');
		initTable(testDb);

		// Call again — should be a no-op
		initTable(testDb);

		const version = testDb.pragma('user_version', { simple: true });
		expect(version).toBe(1);

		testDb.close();
	});

	it('DB with table but missing version column: migration adds it', () => {
		const testDb = new Database(':memory:');
		// Manually create table WITHOUT version column
		testDb.pragma('user_version = 0');
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

		const version = testDb.pragma('user_version', { simple: true });
		expect(version).toBe(1);

		const cols = testDb.pragma('table_info(cache)') as Array<{ name: string }>;
		expect(cols.some((c) => c.name === 'version')).toBe(true);

		testDb.close();
	});

	it('calling initTable twice is idempotent', () => {
		const testDb = new Database(':memory:');
		initTable(testDb);
		initTable(testDb);
		initTable(testDb);

		const version = testDb.pragma('user_version', { simple: true });
		expect(version).toBe(1);

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
