export function load() {
	const today = new Date();
	const twoWeeks = new Date(today);
	twoWeeks.setDate(today.getDate() + 14);

	const start = today.toISOString().split('T')[0];
	const end = twoWeeks.toISOString().split('T')[0];

	return { start, end };
}
