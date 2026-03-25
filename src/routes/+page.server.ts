export function load() {
	// Dates are computed client-side to respect the user's timezone.
	// The server returns nulls; the component initializes from local Date().
	return { start: null as string | null, end: null as string | null };
}
