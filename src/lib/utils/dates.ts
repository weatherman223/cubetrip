/** Format a Date as YYYY-MM-DD in the local timezone. */
export function toYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
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
