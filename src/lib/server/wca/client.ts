import type {
	WCACompetition,
	WCIFPublicData,
	EnrichedCompetition,
	EnrichedWCIF,
	RegistrationStatus,
	WCIFActivity
} from './types';
import { getCache, setCache, TTL } from '$lib/server/cache';

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
function parseLinkHeader(header: string | null): Record<string, string> {
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

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
			console.warn(`WCA API retry ${attempt}/${MAX_RETRIES} for ${url} in ${backoff}ms`);
			await delay(backoff);
		}

		const res = await fetch(url, {
			headers: { Accept: 'application/json' }
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

	const all: WCACompetition[] = [];
	let nextUrl: string | undefined =
		`${WCA_API_BASE}/competitions?start=${params.start}&end=${params.end}`;

	while (nextUrl) {
		const result: { data: WCACompetition[]; links: Record<string, string> } =
			await wcaFetch<WCACompetition[]>(nextUrl);
		all.push(...result.data);
		nextUrl = result.links.next;
	}

	setCache(cacheKey, all, TTL.COMPETITIONS);
	return all;
}

/**
 * Fetch WCIF public data for a single competition, trimmed to only the fields CubeTrip needs.
 */
export async function fetchWCIF(id: string): Promise<WCIFPublicData> {
	const cacheKey = `wcif:${id}`;
	const cached = getCache<WCIFPublicData>(cacheKey);
	if (cached) return cached;

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
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch WCIF public data for multiple competitions with concurrency control.
 * Processes in batches to avoid hammering the WCA API.
 * Failed fetches are logged and skipped — the returned Map only contains successes.
 */
export async function fetchWCIFBatch(
	ids: string[],
	options: { concurrency?: number; delayMs?: number } = {}
): Promise<Map<string, WCIFPublicData>> {
	const { concurrency = 3, delayMs = 200 } = options;
	const results = new Map<string, WCIFPublicData>();

	for (let i = 0; i < ids.length; i += concurrency) {
		if (i > 0) await delay(delayMs);

		const chunk = ids.slice(i, i + concurrency);
		const settled = await Promise.allSettled(chunk.map((id) => fetchWCIF(id)));

		for (let j = 0; j < settled.length; j++) {
			const result = settled[j];
			if (result.status === 'fulfilled') {
				results.set(chunk[j], result.value);
			} else {
				console.warn(`WCIF fetch failed for ${chunk[j]}:`, result.reason);
			}
		}
	}

	return results;
}

function computeRegistrationStatus(
	competition: WCACompetition,
	wcif: WCIFPublicData
): RegistrationStatus {
	if (competition.cancelled_at !== null) return 'closed';

	const now = new Date();
	const open = new Date(wcif.registrationInfo.openTime);
	const close = new Date(wcif.registrationInfo.closeTime);

	if (now >= open && now <= close) {
		if (wcif.competitorLimit !== null && wcif.competitorCount >= wcif.competitorLimit) {
			return 'waitlist';
		}
		return 'open';
	}
	if (wcif.registrationInfo.onTheSpotRegistration) return 'on-the-spot';
	return 'closed';
}

function collectActivities(activities: WCIFActivity[]): WCIFActivity[] {
	const all: WCIFActivity[] = [];
	for (const a of activities) {
		all.push(a);
		if (a.childActivities.length > 0) {
			all.push(...collectActivities(a.childActivities));
		}
	}
	return all;
}

function computeScheduleTimes(wcif: WCIFPublicData): {
	start: string | null;
	end: string | null;
} {
	const allActivities = wcif.schedule.venues.flatMap((v) =>
		v.rooms.flatMap((r) => collectActivities(r.activities))
	);

	if (allActivities.length === 0) return { start: null, end: null };

	let earliest = allActivities[0].startTime;
	let latest = allActivities[0].endTime;

	for (const a of allActivities) {
		if (a.startTime < earliest) earliest = a.startTime;
		if (a.endTime > latest) latest = a.endTime;
	}

	return { start: earliest, end: latest };
}

/**
 * Enrich competitions with WCIF data (registration status, schedule times, competitor limit).
 * Fetches WCIF in batches with concurrency control.
 */
export async function enrichCompetitions(
	competitions: WCACompetition[]
): Promise<EnrichedCompetition[]> {
	const ids = competitions.map((c) => c.id);
	const wcifMap = await fetchWCIFBatch(ids);

	return competitions.map((comp) => {
		const wcifData = wcifMap.get(comp.id);

		let wcif: EnrichedWCIF | null = null;
		if (wcifData) {
			const times = computeScheduleTimes(wcifData);
			wcif = {
				onTheSpotRegistration: wcifData.registrationInfo.onTheSpotRegistration,
				competitorLimit: wcifData.competitorLimit,
				competitorCount: wcifData.competitorCount,
				registrationStatus: computeRegistrationStatus(comp, wcifData),
				scheduleStartTime: times.start,
				scheduleEndTime: times.end
			};
		}

		return { ...comp, wcif };
	});
}
