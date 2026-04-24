import { delay } from '$lib/utils/delay';

// Queue tuning. Conservative defaults used to be 6 concurrent @ 250ms spacing
// (~24 req/s). After the per-route no-inventory cache absorbed most of the
// wasted requests and we added a 5-min server-side failure cache, there's
// enough headroom to push harder: 10 concurrent @ 150ms ≈ 67 req/s. Queue
// depth raised to 100 so a weekend-scale fan-out (15 comps × 3 origins × 5
// airports = 225 concurrent requests peaking on day 1) absorbs into the queue
// instead of cascading 429s at the client.
const MAX_QUEUE_DEPTH = 100;
const MAX_CONCURRENT = 10;
const MIN_SPACING_MS = 150;
const BACKOFF_CAP_MS = 30000;
const ERROR_DECAY_MS = 60000;

export class QueueFullError extends Error {
	constructor() {
		super('Flight request queue is full. Try again later.');
		this.name = 'QueueFullError';
	}
}

export class RequestQueue {
	private pending = 0;
	private active = 0;
	private lastRequestTime = 0;
	private consecutiveErrors = 0;
	private lastErrorTime = 0;
	private waiters: Array<() => void> = [];
	// Head pointer for O(1) dequeue — Array.shift() is O(n) because it re-indexes.
	// We compact the array when head passes the halfway mark to bound memory growth.
	private waitersHead = 0;

	/**
	 * Enqueue a function to run with rate limiting.
	 * Max 3 concurrent, min 1s spacing, exponential backoff on errors.
	 * Rejects immediately if queue depth exceeds 50.
	 */
	async enqueue<T>(fn: () => Promise<T>): Promise<T> {
		if (this.pending >= MAX_QUEUE_DEPTH) {
			throw new QueueFullError();
		}

		this.pending++;

		// Wait for a concurrency slot
		while (this.active >= MAX_CONCURRENT) {
			await new Promise<void>((resolve) => this.waiters.push(resolve));
		}

		// Wait for minimum spacing + backoff, re-checking concurrency after sleep
		let ready = false;
		while (!ready) {
			// Re-check concurrency — another request may have claimed a slot during our sleep
			while (this.active >= MAX_CONCURRENT) {
				await new Promise<void>((resolve) => this.waiters.push(resolve));
			}

			const now = Date.now();
			// Decay: reset backoff if queue is empty and last error was >60s ago
			if (
				this.consecutiveErrors > 0 &&
				this.pending <= 1 &&
				now - this.lastErrorTime > ERROR_DECAY_MS
			) {
				this.consecutiveErrors = 0;
			}

			const backoff =
				this.consecutiveErrors > 0
					? Math.min(MIN_SPACING_MS * 2 ** this.consecutiveErrors, BACKOFF_CAP_MS)
					: MIN_SPACING_MS;
			const elapsed = now - this.lastRequestTime;
			if (elapsed < backoff) {
				await delay(backoff - elapsed);
				// After sleeping, re-check concurrency before proceeding
				continue;
			}
			ready = true;
		}

		this.active++;
		this.lastRequestTime = Date.now();

		try {
			const result = await fn();
			this.consecutiveErrors = 0;
			return result;
		} catch (err) {
			this.consecutiveErrors++;
			this.lastErrorTime = Date.now();
			throw err;
		} finally {
			this.active--;
			this.pending--;
			// Wake up next waiter
			if (this.waitersHead < this.waiters.length) {
				this.waiters[this.waitersHead++]();
				// Compact when head passes half the array
				if (this.waitersHead > this.waiters.length / 2) {
					this.waiters = this.waiters.slice(this.waitersHead);
					this.waitersHead = 0;
				}
			}
		}
	}

	get queueDepth(): number {
		return this.pending;
	}

	get backoffErrors(): number {
		return this.consecutiveErrors;
	}
}

/** Singleton request queue for Google Flights requests. */
export const flightQueue = new RequestQueue();
