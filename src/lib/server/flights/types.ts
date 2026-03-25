export interface FlightResult {
	price: number;
	/** Price currency — always USD. Google Flights results are scraped in USD regardless of route. */
	currency: 'USD';
	airline: string;
	departureTime: string;
	arrivalTime: string;
	duration: number;
	stops: number;
	origin: string;
	destination: string;
}

export interface FlightSearchResult {
	flights: FlightResult[];
	fetchedAt: string;
}

export interface FlightProvider {
	searchFlights(
		origin: string,
		destination: string,
		departDate: string,
		returnDate: string
	): Promise<FlightSearchResult>;
}
