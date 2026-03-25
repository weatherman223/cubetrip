import type { EnrichedCompetition, WCIFPublicData } from '$lib/server/wca/types';
import { enrichWCIF } from './enrich-wcif';

/**
 * Retry fetching WCIF for competitions that have wcif === null.
 * Fetches in parallel batches with exponential backoff on failures.
 * Mutates the competitions array in place and returns it for reactivity triggers.
 */
export async function retryUnknownComps(
	competitions: EnrichedCompetition[],
	onUpdate: (comps: EnrichedCompetition[]) => void
): Promise<void> {
	const unknown = competitions.filter((c) => c.wcif === null);
	if (unknown.length === 0) return;

	const MAX_RETRIES = 5;
	const BATCH_SIZE = 5;
	let attempt = 0;
	let remaining = unknown.map((c) => c.id);

	while (remaining.length > 0 && attempt < MAX_RETRIES) {
		// No delay on first attempt (eager load), backoff on retries
		if (attempt > 0) {
			const delay = Math.min(2000 * 2 ** (attempt - 1), 30000);
			await new Promise((r) => setTimeout(r, delay));
		}
		attempt++;

		const stillFailing: string[] = [];

		// Fetch in parallel batches
		for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
			const batch = remaining.slice(i, i + BATCH_SIZE);
			const results = await Promise.allSettled(
				batch.map(async (id) => {
					const res = await fetch(`/api/wcif/${encodeURIComponent(id)}`);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { wcif } = (await res.json()) as { wcif: WCIFPublicData };
					return { id, wcif };
				})
			);

			for (const result of results) {
				if (result.status === 'fulfilled') {
					const { id, wcif } = result.value;
					const comp = competitions.find((c) => c.id === id);
					if (comp) {
						comp.wcif = enrichWCIF(comp.cancelled_at, wcif);
					}
				} else {
					const idx = results.indexOf(result);
					stillFailing.push(batch[idx]);
				}
			}
			onUpdate([...competitions]); // trigger reactivity after each batch
		}

		remaining = stillFailing;
	}
}
