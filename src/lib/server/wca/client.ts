import type { WCACompetition, WCIFPublicData } from './types';
import { getCache, setCache, TTL } from '$lib/server/cache';
import { withCoalesce } from '$lib/server/cache/coalesce';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/server/logger';

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

export class WCAApiError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'WCAApiError';
	}
}

/**
 * Parse a Link header into a map of rel → URL.
 * Format: `<https://...?page=2>; rel="next", <https://...?page=1>; rel="prev"`
 */
export function parseLinkHeader(header: string | null): Record<string, string> {
	if (!header) return {};
	const links: Record<string, string> = {};
	for (const part of header.split(',')) {
		const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
		if (match) {
			links[match[2]] = match[1];
		}
	}
	return links;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

async function wcaFetch<T>(url: string): Promise<{ data: T; links: Record<string, string> }> {
	let lastError: WCAApiError | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
			logger.warn({ attempt, maxRetries: MAX_RETRIES, url, backoff }, 'WCA API retry');
			await delay(backoff);
		}

		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15_000)
		});

		if (res.ok) {
			const data = (await res.json()) as T;
			const links = parseLinkHeader(res.headers.get('Link'));
			return { data, links };
		}

		lastError = new WCAApiError(
			res.status,
			`WCA API error: ${res.status} ${res.statusText} (${url})`
		);

		// Only retry on 5xx server errors
		if (res.status < 500) break;
	}

	throw lastError!;
}

/**
 * Fetch all competitions within a date range, following Link header pagination.
 * @param params.start — Start date in YYYY-MM-DD format
 * @param params.end   — End date in YYYY-MM-DD format
 */
export async function fetchCompetitions(params: {
	start: string;
	end: string;
}): Promise<WCACompetition[]> {
	const cacheKey = `comps:${params.start}:${params.end}`;
	const cached = getCache<WCACompetition[]>(cacheKey);
	if (cached) return cached;

	return withCoalesce(cacheKey, async () => {
		const MAX_PAGES = 20;
		const all: WCACompetition[] = [];
		let nextUrl: string | undefined =
			`${WCA_API_BASE}/competitions?start=${params.start}&end=${params.end}`;
		let page = 0;

		while (nextUrl) {
			if (++page > MAX_PAGES) {
				logger.warn({ maxPages: MAX_PAGES }, 'WCA pagination cap reached, truncating');
				break;
			}
			const result: { data: WCACompetition[]; links: Record<string, string> } =
				await wcaFetch<WCACompetition[]>(nextUrl);
			all.push(...result.data);
			const next = result.links.next;
			if (next && !next.startsWith(WCA_API_BASE)) {
				logger.warn({ url: next }, 'ignoring unexpected pagination URL');
				break;
			}
			nextUrl = next;
		}

		setCache(cacheKey, all, TTL.COMPETITIONS);
		return all;
	});
}

/**
 * Fetch WCIF public data for a single competition, trimmed to only the fields CubeTrip needs.
 */
export async function fetchWCIF(id: string, skipCache = false): Promise<WCIFPublicData> {
	const cacheKey = `wcif:${id}`;
	if (!skipCache) {
		const cached = getCache<WCIFPublicData>(cacheKey);
		if (cached) return cached;
	}

	return withCoalesce(skipCache ? `wcif-fresh:${id}` : cacheKey, async () => {
		const { data } = await wcaFetch<Record<string, unknown>>(
			`${WCA_API_BASE}/competitions/${encodeURIComponent(id)}/wcif/public`
		);
		const persons = data.persons as Array<{ registration?: { status?: string } }> | undefined;
		const competitorCount = persons
			? persons.filter((p) => p.registration?.status === 'accepted').length
			: 0;

		const result: WCIFPublicData = {
			id: data.id as string,
			name: data.name as string,
			competitorLimit: (data.competitorLimit as number | null) ?? null,
			competitorCount,
			registrationInfo: data.registrationInfo as WCIFPublicData['registrationInfo'],
			schedule: data.schedule as WCIFPublicData['schedule']
		};

		setCache(cacheKey, result, TTL.WCIF);
		return result;
	});
}
