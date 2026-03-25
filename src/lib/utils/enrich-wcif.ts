import type {
	WCIFPublicData,
	WCIFActivity,
	EnrichedWCIF,
	RegistrationStatus
} from '$lib/server/wca/types';

export function collectActivities(activities: WCIFActivity[]): WCIFActivity[] {
	const all: WCIFActivity[] = [];
	for (const a of activities) {
		all.push(a);
		if (a.childActivities.length > 0) {
			all.push(...collectActivities(a.childActivities));
		}
	}
	return all;
}

export function computeScheduleTimes(wcif: WCIFPublicData): {
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

export function computeRegistrationStatus(
	cancelledAt: string | null,
	wcif: WCIFPublicData
): RegistrationStatus {
	if (cancelledAt !== null) return 'closed';

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

/**
 * Enrich raw WCIF data into the shape the UI expects.
 * Shared by both server-side enrichment and client-side retry/refresh paths.
 */
export function enrichWCIF(cancelledAt: string | null, wcif: WCIFPublicData): EnrichedWCIF {
	const times = computeScheduleTimes(wcif);
	return {
		onTheSpotRegistration: wcif.registrationInfo.onTheSpotRegistration,
		competitorLimit: wcif.competitorLimit,
		competitorCount: wcif.competitorCount,
		registrationStatus: computeRegistrationStatus(cancelledAt, wcif),
		scheduleStartTime: times.start,
		scheduleEndTime: times.end
	};
}
