const USER_AGENTS = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
];

let uaIndex = 0;

function getNextUserAgent(): string {
	const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
	uaIndex++;
	return ua;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

class FlightFetchError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'FlightFetchError';
	}
}

/**
 * Fetch the Google Flights search page HTML for a given tfs parameter.
 * Includes User-Agent rotation and retry with exponential backoff.
 */
export async function fetchFlightPage(tfsParam: string): Promise<string> {
	const url = `https://www.google.com/travel/flights/search?tfs=${encodeURIComponent(tfsParam)}&hl=en&curr=USD`;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}

		try {
			const res = await fetch(url, {
				headers: {
					'User-Agent': getNextUserAgent(),
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'no-cache',
					Pragma: 'no-cache'
				},
				signal: AbortSignal.timeout(15_000)
			});

			if (!res.ok) {
				lastError = new FlightFetchError(
					res.status,
					`Google Flights returned ${res.status} ${res.statusText}`
				);
				if (res.status < 500) break; // Don't retry client errors
				continue;
			}

			return await res.text();
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
		}
	}

	throw lastError ?? new Error('Flight fetch failed after all retries');
}
