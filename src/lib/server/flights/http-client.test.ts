import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockResponse(status: number, body = '', statusText = 'OK'): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		text: vi.fn().mockResolvedValue(body)
	} as unknown as Response;
}

describe('fetchFlightPage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('200 returns body text', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(200, '<html>flights</html>')
		);
		const { fetchFlightPage } = await import('./http-client');
		const result = await fetchFlightPage('test-tfs');
		expect(result).toBe('<html>flights</html>');
	});

	it('500 then 200 retries and succeeds', async () => {
		(global.fetch as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(mockResponse(500, '', 'Internal Server Error'))
			.mockResolvedValueOnce(mockResponse(200, '<html>ok</html>'));

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');
		await vi.advanceTimersByTimeAsync(5000);
		const result = await promise;
		expect(result).toBe('<html>ok</html>');
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('three 500s throws after exhausting retries', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(500, '', 'Internal Server Error')
		);

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');

		// Attach rejection handler immediately to avoid unhandled rejection
		const resultPromise = promise.then(
			() => {
				throw new Error('should have thrown');
			},
			(err: Error) => err
		);

		await vi.advanceTimersByTimeAsync(10000);
		const err = await resultPromise;
		expect(err).toBeInstanceOf(Error);
		expect(global.fetch).toHaveBeenCalledTimes(3);
	});

	it('403 fails immediately without retry', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(403, '', 'Forbidden')
		);

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');

		const resultPromise = promise.then(
			() => {
				throw new Error('should have thrown');
			},
			(err: Error) => err
		);

		await vi.advanceTimersByTimeAsync(5000);
		const err = await resultPromise;
		expect(err).toBeInstanceOf(Error);
		expect(err.message).toContain('403');
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('404 fails immediately without retry', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(404, '', 'Not Found')
		);

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');

		const resultPromise = promise.then(
			() => {
				throw new Error('should have thrown');
			},
			(err: Error) => err
		);

		await vi.advanceTimersByTimeAsync(5000);
		const err = await resultPromise;
		expect(err).toBeInstanceOf(Error);
		expect(err.message).toContain('404');
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('network error triggers retry', async () => {
		(global.fetch as ReturnType<typeof vi.fn>)
			.mockRejectedValueOnce(new TypeError('fetch failed'))
			.mockResolvedValueOnce(mockResponse(200, '<html>recovered</html>'));

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');
		await vi.advanceTimersByTimeAsync(5000);
		const result = await promise;
		expect(result).toBe('<html>recovered</html>');
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('timeout triggers retry', async () => {
		const timeoutError = new DOMException('The operation was aborted', 'AbortError');
		(global.fetch as ReturnType<typeof vi.fn>)
			.mockRejectedValueOnce(timeoutError)
			.mockResolvedValueOnce(mockResponse(200, '<html>after-timeout</html>'));

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');
		await vi.advanceTimersByTimeAsync(5000);
		const result = await promise;
		expect(result).toBe('<html>after-timeout</html>');
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('backoff: second wait is longer than first', async () => {
		const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(500, '', 'Error'));

		const { fetchFlightPage } = await import('./http-client');
		const promise = fetchFlightPage('test-tfs');

		const resultPromise = promise.then(
			() => {
				throw new Error('should have thrown');
			},
			(err: Error) => err
		);

		await vi.advanceTimersByTimeAsync(10000);
		await resultPromise;

		// Collect the backoff delays passed to setTimeout during retries.
		// Filter is broad to tolerate tuning of RETRY_BASE_MS — the guarantee we
		// care about is the exponential shape, not the absolute magnitude.
		const backoffDelays = setTimeoutSpy.mock.calls
			.filter(([, delay]) => typeof delay === 'number' && delay >= 100)
			.map(([, delay]) => delay as number);

		expect(backoffDelays.length).toBeGreaterThanOrEqual(2);
		expect(backoffDelays[1]).toBeGreaterThan(backoffDelays[0]);
	});

	it('User-Agent rotates across consecutive calls', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(200, '<html>ok</html>')
		);

		const { fetchFlightPage } = await import('./http-client');

		await fetchFlightPage('tfs1');
		await fetchFlightPage('tfs2');

		const firstUA = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers[
			'User-Agent'
		];
		const secondUA = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].headers[
			'User-Agent'
		];

		expect(firstUA).toBeTruthy();
		expect(secondUA).toBeTruthy();
		expect(firstUA).not.toBe(secondUA);
	});

	it('request includes Accept and Accept-Language headers', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse(200, '<html>ok</html>')
		);

		const { fetchFlightPage } = await import('./http-client');
		await fetchFlightPage('test-tfs');

		const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
		expect(headers['Accept']).toBe(
			'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
		);
		expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');
	});
});
