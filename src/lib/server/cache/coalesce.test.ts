import { describe, it, expect, vi } from 'vitest';
import { withCoalesce } from './coalesce';

describe('withCoalesce', () => {
	it('single call executes fn and returns result', async () => {
		const result = await withCoalesce('single', async () => 'hello');
		expect(result).toBe('hello');
	});

	it('two concurrent calls with same key run fn exactly once', async () => {
		const fn = vi.fn();
		let resolve!: (v: string) => void;
		const controlled = new Promise<string>((r) => {
			resolve = r;
		});

		fn.mockReturnValue(controlled);

		const p1 = withCoalesce('dedup', fn);
		const p2 = withCoalesce('dedup', fn);

		resolve('shared-result');

		await Promise.all([p1, p2]);

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('both callers receive the same resolved value', async () => {
		let resolve!: (v: string) => void;
		const controlled = new Promise<string>((r) => {
			resolve = r;
		});

		const p1 = withCoalesce('same-val', () => controlled);
		const p2 = withCoalesce('same-val', () => controlled);

		resolve('the-value');

		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).toBe('the-value');
		expect(r2).toBe('the-value');
	});

	it('two concurrent calls with different keys both execute', async () => {
		const counter = { count: 0 };

		let resolveA!: (v: string) => void;
		let resolveB!: (v: string) => void;
		const promiseA = new Promise<string>((r) => {
			resolveA = r;
		});
		const promiseB = new Promise<string>((r) => {
			resolveB = r;
		});

		const p1 = withCoalesce('key-a', () => {
			counter.count++;
			return promiseA;
		});
		const p2 = withCoalesce('key-b', () => {
			counter.count++;
			return promiseB;
		});

		expect(counter.count).toBe(2);

		resolveA('a');
		resolveB('b');

		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).toBe('a');
		expect(r2).toBe('b');
	});

	it('after resolve, same key triggers a new fn execution', async () => {
		const fn = vi.fn();

		let resolve1!: (v: string) => void;
		const controlled1 = new Promise<string>((r) => {
			resolve1 = r;
		});
		fn.mockReturnValueOnce(controlled1);

		const p1 = withCoalesce('reuse', fn);
		resolve1('first');
		await p1;

		// The key should now be cleaned up by finally(). A new call should invoke fn again.
		let resolve2!: (v: string) => void;
		const controlled2 = new Promise<string>((r) => {
			resolve2 = r;
		});
		fn.mockReturnValueOnce(controlled2);

		const p2 = withCoalesce('reuse', fn);
		resolve2('second');
		const result = await p2;

		expect(fn).toHaveBeenCalledTimes(2);
		expect(result).toBe('second');
	});

	it('fn throws: all waiters receive the rejection', async () => {
		let reject!: (e: Error) => void;
		const controlled = new Promise<string>((_, r) => {
			reject = r;
		});

		const p1 = withCoalesce('err-key', () => controlled);
		const p2 = withCoalesce('err-key', () => controlled);

		reject(new Error('boom'));

		await expect(p1).rejects.toThrow('boom');
		await expect(p2).rejects.toThrow('boom');
	});

	it('fn throws then retry: fresh fn execution after failure', async () => {
		let reject!: (e: Error) => void;
		const failing = new Promise<string>((_, r) => {
			reject = r;
		});

		const p1 = withCoalesce('retry-key', () => failing);
		reject(new Error('fail'));

		await expect(p1).rejects.toThrow('fail');

		// After rejection, finally() should have cleaned up the key.
		// A new call should execute a fresh fn.
		const p2 = withCoalesce('retry-key', async () => 'recovered');
		const result = await p2;
		expect(result).toBe('recovered');
	});
});
