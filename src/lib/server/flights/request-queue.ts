const MAX_QUEUE_DEPTH = 50;
const MAX_CONCURRENT = 3;
const MIN_SPACING_MS = 1000;
const BACKOFF_CAP_MS = 30000;

export class QueueFullError extends Error {
	constructor() {
		super('Flight request queue is full. Try again later.');
		this.name = 'QueueFullError';
	}
}

class RequestQueue {
	private pending = 0;
	private active = 0;
	private lastRequestTime = 0;
	private consecutiveErrors = 0;
	private waiters: Array<() => void> = [];
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

		// Wait for minimum spacing + backoff
		const now = Date.now();
		const backoff =
			this.consecutiveErrors > 0
				? Math.min(MIN_SPACING_MS * 2 ** this.consecutiveErrors, BACKOFF_CAP_MS)
				: MIN_SPACING_MS;
		const elapsed = now - this.lastRequestTime;
		if (elapsed < backoff) {
			await new Promise((r) => setTimeout(r, backoff - elapsed));
		}

		this.active++;
		this.lastRequestTime = Date.now();

		try {
			const result = await fn();
			this.consecutiveErrors = 0;
			return result;
		} catch (err) {
			this.consecutiveErrors++;
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
}

/** Singleton request queue for Google Flights requests. */
export const flightQueue = new RequestQueue();
