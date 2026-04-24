export const TTL = {
	COMPETITIONS: 60 * 60 * 1000,
	WCIF: 2 * 60 * 60 * 1000,
	FLIGHTS: 12 * 60 * 60 * 1000,
	// Short negative-cache window for failed upstream fetches. Short enough to
	// recover from transient WCA / Google outages; long enough to stop the
	// client retry loop from re-hammering upstream every 2s→4s→…→30s wave.
	WCIF_FAILURE: 5 * 60 * 1000,
	FLIGHT_FAILURE: 5 * 60 * 1000
};
