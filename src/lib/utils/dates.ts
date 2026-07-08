/** Format a Date as YYYY-MM-DD in the local timezone. */
export function toYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * Convert a UTC instant (ISO string, e.g. WCIF's "2026-08-15T14:00:00Z") into
 * the given IANA timezone's wall-clock time as a naive "YYYY-MM-DDTHH:MM:SS"
 * string. Used to compare WCIF schedule times against Google's flight times,
 * which are naive venue-local strings with no zone information.
 * Returns the input unchanged if the timezone or instant is invalid.
 */
export function utcToVenueLocal(isoUtc: string, timeZone: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(new Date(isoUtc));
		const get = (type: Intl.DateTimeFormatPartTypes) =>
			parts.find((p) => p.type === type)?.value ?? '00';
		// Some ICU versions format midnight as "24" with hour12: false.
		const hour = get('hour') === '24' ? '00' : get('hour');
		return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
	} catch {
		return isoUtc;
	}
}

/** Get the Saturday–Sunday date range for N weekends ahead. */
export function getWeekend(weeksAhead: number): { start: string; end: string } {
	const now = new Date();
	const day = now.getDay();
	const daysToSat = ((6 - day + 7) % 7) + (weeksAhead - 1) * 7;
	const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSat);
	const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1);
	return { start: toYMD(sat), end: toYMD(sun) };
}
