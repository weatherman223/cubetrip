export type { FlightResult, FlightSearchResult, FlightProvider } from './types';
export { MockProvider } from './mock-provider';
export { GoogleFlightsProtobufProvider } from './google-flights-provider';

import { env } from '$env/dynamic/private';
import { MockProvider } from './mock-provider';
import { GoogleFlightsProtobufProvider } from './google-flights-provider';

/** Singleton flight provider — toggle with USE_MOCK_FLIGHTS=true env var. */
export const flightProvider =
	env.USE_MOCK_FLIGHTS === 'true' ? new MockProvider() : new GoogleFlightsProtobufProvider();
