import type { EnrichedCompetition, WCIFPublicData } from '$lib/server/wca/types';
import { enrichWCIF } from './enrich-wcif';
import { delay } from '$lib/utils/delay';

/**
 * Retry fetching WCIF for competitions that have wcif === null.
 *
 * Fires one parallel fan-out per attempt: all unresolved comps are requested
 * concurrently via Promise.allSettled. The server coalesces duplicate IDs in
 * flight and negative-caches 5xx failures so this doesn't hammer WCA upstream.
 *
 * Retries happen as successive attempts with exponential backoff. Mutates the
 * competitions array in place; calls onUpdate once per attempt after the
 * attempt's results have been applied.
 */
export async function retryUnknownComps(
	competitions: EnrichedCompetition[],
	onUpdate: (comps: EnrichedCompetition[]) => void
): Promise<void> {
	const unknown = competitions.filter((c) => c.wcif === null);
	if (unknown.length === 0) return;

	// Tight retry budget. Real comps without published WCIFs will fail all
	// attempts anyway; longer waits just make the progress bar look stuck.
	// 3 attempts with 1s→2s backoff = ~3s of pure sleep worst case, down from
	// the old 5 attempts × 2s-16s = 30s schedule.
	const MAX_RETRIES = 3;
	let attempt = 0;
	let remaining = unknown.map((c) => c.id);

	while (remaining.length > 0 && attempt < MAX_RETRIES) {
		// No delay on first attempt (eager load), exponential backoff on retries
		if (attempt > 0) {
			const backoff = Math.min(1000 * 2 ** (attempt - 1), 30000);
			await delay(backoff);
		}
		attempt++;

		const results = await Promise.allSettled(
			remaining.map(async (id) => {
				const res = await fetch(`/api/wcif/${encodeURIComponent(id)}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const { wcif } = (await res.json()) as { wcif: WCIFPublicData };
				return { id, wcif };
			})
		);

		const stillFailing: string[] = [];
		let anyResolved = false;
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'fulfilled') {
				const { id, wcif } = result.value;
				const comp = competitions.find((c) => c.id === id);
				if (comp) {
					comp.wcif = enrichWCIF(comp.cancelled_at, wcif);
					anyResolved = true;
				}
			} else {
				stillFailing.push(remaining[i]);
			}
		}

		if (anyResolved) onUpdate([...competitions]);
		remaining = stillFailing;
	}
}
