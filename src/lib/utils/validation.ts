const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a date string is both well-formatted (YYYY-MM-DD) and semantically valid.
 * Rejects impossible dates like 2024-99-99 and dates outside a reasonable range.
 */
export function isValidDate(str: string): boolean {
	if (!DATE_RE.test(str)) return false;
	const parsed = new Date(str + 'T00:00:00Z');
	if (isNaN(parsed.getTime())) return false;
	// Verify the parsed date matches the input (catches month overflow like Feb 30)
	const [y, m, d] = str.split('-').map(Number);
	if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() + 1 !== m || parsed.getUTCDate() !== d)
		return false;
	// Reasonable range: not before 2020, not more than 1 year in the future
	const now = new Date();
	const minDate = new Date('2020-01-01T00:00:00Z');
	const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
	return parsed >= minDate && parsed <= maxDate;
}

/**
 * Check that a date range does not exceed a maximum number of days.
 */
export function isDateRangeValid(start: string, end: string, maxDays: number): boolean {
	const s = new Date(start + 'T00:00:00Z');
	const e = new Date(end + 'T00:00:00Z');
	if (e < s) return false;
	const diffMs = e.getTime() - s.getTime();
	return diffMs <= maxDays * 24 * 60 * 60 * 1000;
}
