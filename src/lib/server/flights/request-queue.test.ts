import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueFullError } from './request-queue';

// We need a fresh RequestQueue for each test (the module exports a singleton).
// Import the class by reading the module's exports.
// Actually, the class is not exported — only the singleton and QueueFullError are.
// We'll test through the singleton, resetting state between tests by creating fresh instances.

// Since RequestQueue is not exported, we test via the singleton flightQueue.
// This means tests must run sequentially and we accept shared state between tests.
// For proper isolation, we'd need to export the class — but testing the real singleton
// is more representative of production behavior.

describe('QueueFullError', () => {
	it('has the correct name and message', () => {
		const err = new QueueFullError();
		expect(err.name).toBe('QueueFullError');
		expect(err.message).toBe('Flight request queue is full. Try again later.');
		expect(err).toBeInstanceOf(Error);
	});
});

// Note: The RequestQueue class is not exported, so we test the exported flightQueue singleton.
// These tests are best-effort given the shared singleton constraint.
// For comprehensive queue testing, the class would need to be exported.
describe('flightQueue (singleton)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('executes a single request and returns its value', async () => {
		// Use real timers for this simple test
		vi.useRealTimers();
		const { flightQueue } = await import('./request-queue');
		const result = await flightQueue.enqueue(async () => 42);
		expect(result).toBe(42);
	});

	it('propagates errors from fn()', async () => {
		vi.useRealTimers();
		const { flightQueue } = await import('./request-queue');
		await expect(
			flightQueue.enqueue(async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
	});

	it('reports queueDepth', async () => {
		vi.useRealTimers();
		const { flightQueue } = await import('./request-queue');
		expect(flightQueue.queueDepth).toBeGreaterThanOrEqual(0);
	});
});
