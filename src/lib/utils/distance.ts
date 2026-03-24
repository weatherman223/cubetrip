const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in kilometers. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Great-circle distance between two coordinates in miles. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
	return haversine(lat1, lon1, lat2, lon2) * KM_TO_MILES;
}
