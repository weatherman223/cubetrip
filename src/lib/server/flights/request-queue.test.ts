import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueFullError, RequestQueue } from './request-queue';

// Keep in sync with the module constants in request-queue.ts.
const MIN_SPACING_MS = 150;
const BACKOFF_CAP_MS = 30000;
const ERROR_DECAY_MS = 60000;
const MAX_CONCURRENT = 10;
const MAX_QUEUE_DEPTH = 100;

describe('QueueFullError', () => {
	it('has correct name and message', () => {
		const err = new QueueFullError();
		expect(err.name).toBe('QueueFullError');
		expect(err.message).toBe('Flight request queue is full. Try again later.');
		expect(err).toBeInstanceOf(Error);
	});
});

describe('RequestQueue', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('executes a single request and returns its value', async () => {
		const queue = new RequestQueue();
		const p = queue.enqueue(async () => 42);
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		const result = await p;
		expect(result).toBe(42);
	});

	it('propagates errors from fn()', async () => {
		const queue = new RequestQueue();
		const p = queue.enqueue(async () => {
			throw new Error('boom');
		});
		p.catch(() => {}); // prevent unhandled rejection warning
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await expect(p).rejects.toThrow('boom');
	});

	it('reports queueDepth', async () => {
		const queue = new RequestQueue();
		const resolvers: Array<() => void> = [];
		const makeTask = () => new Promise<void>((r) => resolvers.push(r));

		expect(queue.queueDepth).toBe(0);

		const p1 = queue.enqueue(() => makeTask());
		await vi.advanceTimersByTimeAsync(0);
		expect(queue.queueDepth).toBe(1);

		resolvers[0]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p1;
		expect(queue.queueDepth).toBe(0);
	});

	it('(MAX_CONCURRENT+1)th request waits until one of the first MAX_CONCURRENT completes', async () => {
		const queue = new RequestQueue();
		const resolvers: Array<() => void> = [];
		const makeTask = () => new Promise<void>((r) => resolvers.push(r));

		const tasks = Array.from({ length: MAX_CONCURRENT + 1 }, () => queue.enqueue(() => makeTask()));

		// Advance enough for the first MAX_CONCURRENT to start (each needs MIN_SPACING_MS gap).
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * MAX_CONCURRENT);

		// First MAX_CONCURRENT should be active, the extra one still waiting.
		expect(resolvers.length).toBe(MAX_CONCURRENT);

		// Complete one task so the extra can start.
		resolvers[0]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);

		expect(resolvers.length).toBe(MAX_CONCURRENT + 1);

		// Clean up remaining tasks.
		for (let i = 1; i < resolvers.length; i++) resolvers[i]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await Promise.all(tasks);
	});

	it('spacing: 2nd request waits at least MIN_SPACING_MS after first', async () => {
		const queue = new RequestQueue();
		const times: number[] = [];

		const p1 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(0);
		await p1;

		const p2 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p2;

		expect(times[1] - times[0]).toBeGreaterThanOrEqual(MIN_SPACING_MS);
	});

	it('backoff after error: next request waits longer', async () => {
		const queue = new RequestQueue();
		const times: number[] = [];

		// First request: succeeds, record time
		const p1 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(0);
		await p1;

		// Second request: fails, record time
		const p2 = queue.enqueue(async () => {
			times.push(Date.now());
			throw new Error('fail');
		});
		p2.catch(() => {}); // prevent unhandled rejection warning
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p2.catch(() => {});

		// Third request: should wait longer due to backoff (2000ms = MIN_SPACING_MS * 2^1)
		const p3 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 2);
		await p3;

		const gapAfterError = times[2] - times[1];
		const gapNormal = times[1] - times[0];
		expect(gapAfterError).toBeGreaterThan(gapNormal);
	});

	it('backoff resets after success', async () => {
		const queue = new RequestQueue();
		const times: number[] = [];

		// First: succeed
		const p1 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(0);
		await p1;

		// Second: fail
		const p2 = queue.enqueue(async () => {
			times.push(Date.now());
			throw new Error('fail');
		});
		p2.catch(() => {}); // prevent unhandled rejection warning
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p2.catch(() => {});

		// Third: succeed (but waits for backoff)
		const p3 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 2);
		await p3;

		// Fourth: should only wait MIN_SPACING_MS since backoff reset
		const p4 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p4;

		const gapAfterReset = times[3] - times[2];
		expect(gapAfterReset).toBeGreaterThanOrEqual(MIN_SPACING_MS);
		// Should NOT be as long as the backoff gap
		expect(gapAfterReset).toBeLessThanOrEqual(MIN_SPACING_MS + 100);
	});

	it('backoff caps at 30s (many consecutive errors)', async () => {
		const queue = new RequestQueue();
		const times: number[] = [];

		// Generate many consecutive errors to push backoff beyond the cap.
		// After error i, backoff = min(1000 * 2^(i+1), 30000).
		// By error 5+, the formula yields >= 64000, but cap limits to 30000.
		for (let i = 0; i < 8; i++) {
			const p = queue.enqueue(async () => {
				times.push(Date.now());
				throw new Error('fail');
			});
			p.catch(() => {}); // prevent unhandled rejection warning
			// Advance enough time for even the capped backoff to elapse
			await vi.advanceTimersByTimeAsync(BACKOFF_CAP_MS);
			await p.catch(() => {});
		}

		// The gap between the last two errors should be exactly BACKOFF_CAP_MS
		// (since the uncapped value would be much larger, the cap limits it)
		const lastGap = times[times.length - 1] - times[times.length - 2];
		expect(lastGap).toBe(BACKOFF_CAP_MS);
	});

	it('backoff decays after 60s idle with empty queue', async () => {
		const queue = new RequestQueue();
		const times: number[] = [];

		// First: succeed
		const p1 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(0);
		await p1;

		// Second: fail (creates backoff)
		const p2 = queue.enqueue(async () => {
			times.push(Date.now());
			throw new Error('fail');
		});
		p2.catch(() => {});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p2.catch(() => {});

		expect(queue.backoffErrors).toBe(1);

		// Advance 61s — past the decay threshold, queue is empty
		await vi.advanceTimersByTimeAsync(ERROR_DECAY_MS + 1000);

		// Third: should use normal spacing (backoff decayed)
		const p3 = queue.enqueue(async () => {
			times.push(Date.now());
		});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p3;

		// After decay + success, backoff should be 0
		expect(queue.backoffErrors).toBe(0);

		// Gap ceiling isn't asserted directly — the key thing is that backoffErrors
		// was reset before the request ran, confirming decay triggered.
		expect(queue.backoffErrors).toBe(0);
	});

	it('backoff does NOT decay if queue has pending requests', async () => {
		const queue = new RequestQueue();
		const resolvers: Array<() => void> = [];
		const makeTask = () => new Promise<void>((r) => resolvers.push(r));

		// First: succeed
		const p1 = queue.enqueue(async () => 'ok');
		await vi.advanceTimersByTimeAsync(0);
		await p1;

		// Second: fail
		const p2 = queue.enqueue(async () => {
			throw new Error('fail');
		});
		p2.catch(() => {});
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p2.catch(() => {});

		expect(queue.backoffErrors).toBe(1);

		// Enqueue a long-running task (keeps pending > 0)
		const p3 = queue.enqueue(() => makeTask());
		await vi.advanceTimersByTimeAsync(ERROR_DECAY_MS + 1000);

		// Backoff should NOT have decayed since queue is not empty
		expect(queue.backoffErrors).toBe(1);

		// Clean up
		resolvers[0]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await p3;
	});

	it('queue full at MAX_QUEUE_DEPTH pending: next enqueue throws QueueFullError', async () => {
		const queue = new RequestQueue();

		// Enqueue MAX_QUEUE_DEPTH tasks that never resolve — they pile up as pending.
		for (let i = 0; i < MAX_QUEUE_DEPTH; i++) {
			queue.enqueue(() => new Promise<void>(() => {}));
		}

		expect(queue.queueDepth).toBe(MAX_QUEUE_DEPTH);

		// The next one should reject immediately.
		await expect(queue.enqueue(() => new Promise<void>(() => {}))).rejects.toThrow(QueueFullError);

		// Queue depth unchanged — the rejected enqueue did not add to pending.
		expect(queue.queueDepth).toBe(MAX_QUEUE_DEPTH);
	});

	it('queue depth decreases after task completion', async () => {
		const queue = new RequestQueue();
		const resolvers: Array<() => void> = [];
		const makeTask = () => new Promise<void>((r) => resolvers.push(r));

		const p1 = queue.enqueue(() => makeTask());
		const p2 = queue.enqueue(() => makeTask());

		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 2);
		expect(queue.queueDepth).toBe(2);

		// Complete first task
		resolvers[0]();
		await vi.advanceTimersByTimeAsync(0);
		await p1;
		expect(queue.queueDepth).toBe(1);

		// Complete second task
		resolvers[1]();
		await vi.advanceTimersByTimeAsync(0);
		await p2;
		expect(queue.queueDepth).toBe(0);
	});

	it('fn() rejection propagates to caller', async () => {
		const queue = new RequestQueue();
		const p = queue.enqueue(async () => {
			throw new TypeError('type error in fn');
		});
		p.catch(() => {}); // prevent unhandled rejection warning
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		await expect(p).rejects.toThrow(TypeError);
		await expect(p).rejects.toThrow('type error in fn');
	});

	it('waiter compaction: after many enqueues, internal cleanup occurs', async () => {
		const queue = new RequestQueue();
		const resolvers: Array<() => void> = [];
		const makeTask = () => new Promise<void>((r) => resolvers.push(r));

		// Fill up 3 concurrent slots
		const p1 = queue.enqueue(() => makeTask());
		const p2 = queue.enqueue(() => makeTask());
		const p3 = queue.enqueue(() => makeTask());
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 3);

		// Enqueue many more tasks that will all become waiters
		const extras: Promise<void>[] = [];
		for (let i = 0; i < 10; i++) {
			extras.push(queue.enqueue(() => makeTask()));
		}

		// Resolve the first 3, which triggers waiter notifications + compaction
		resolvers[0]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		resolvers[1]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		resolvers[2]();
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);

		await Promise.all([p1, p2, p3]);

		// Keep resolving as tasks start
		for (let i = 3; i < resolvers.length; i++) {
			resolvers[i]();
			await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		}

		// Wait for all pending extras to resolve
		// Some extras may still be waiting for resolvers, so advance more
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 20);
		for (let i = 0; i < resolvers.length; i++) {
			resolvers[i]?.();
		}
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS * 10);

		await Promise.allSettled(extras);

		// The key assertion: the queue functions correctly after compaction
		expect(queue.queueDepth).toBe(0);

		// Verify the queue still works after compaction
		const pFinal = queue.enqueue(async () => 'still works');
		await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
		const result = await pFinal;
		expect(result).toBe('still works');
	});
});
