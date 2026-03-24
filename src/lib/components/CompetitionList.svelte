<script lang="ts">
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { FlightResult } from '$lib/server/flights/types';
	import CompetitionCard from './CompetitionCard.svelte';
	import StatusMessage from './StatusMessage.svelte';

	interface AirportFlight {
		flight: FlightResult;
		fetchedAt: string;
		fallbackUrl: string | null;
	}

	interface CompFlightData {
		primary: AirportFlight | null;
		closerAlt: AirportFlight | null;
		cheaperAlt: AirportFlight | null;
		fallbackUrl: string | null;
	}

	let {
		competitions,
		loading,
		error,
		onRetry,
		distances = new Map(),
		driveableRadius = 300,
		unit = 'miles',
		flights = new Map(),
		flightsLoading = false,
		dataFetchedAt = null,
		onRefresh = null,
		refreshStatuses = new Map()
	}: {
		competitions: EnrichedCompetition[];
		loading: boolean;
		error: string | null;
		onRetry: () => void;
		distances?: Map<string, number>;
		driveableRadius?: number;
		unit?: string;
		flights?: Map<string, CompFlightData>;
		flightsLoading?: boolean;
		dataFetchedAt?: string | null;
		onRefresh?: ((compId: string) => void) | null;
		refreshStatuses?: Map<string, 'wcif' | 'flights' | 'done'>;
	} = $props();
</script>

{#if loading}
	<StatusMessage variant="loading" />
{:else if error}
	<StatusMessage variant="error" message={error} {onRetry} />
{:else if competitions.length === 0}
	<StatusMessage variant="empty" />
{:else}
	<div class="flex flex-col gap-4">
		{#each competitions as competition (competition.id)}
			{@const dist = distances.get(competition.id) ?? null}
			{@const flightData = flights.get(competition.id)}
			{@const isDriveable = dist !== null && dist <= driveableRadius}
			{@const flight = flightData?.primary?.flight ?? null}
			{@const compStart = competition.wcif?.scheduleStartTime}
			{@const conflict = !!(
				flight &&
				compStart &&
				flight.arrivalTime &&
				flight.arrivalTime > compStart
			)}
			<CompetitionCard
				{competition}
				distance={dist}
				{isDriveable}
				{unit}
				cheapestFlight={flight}
				flightFetchedAt={flightData?.primary?.fetchedAt ?? null}
				cheaperAltFlight={flightData?.cheaperAlt?.flight ?? null}
				flightFallbackUrl={flightData?.fallbackUrl ?? null}
				flightLoading={flightsLoading && !isDriveable && !flightData}
				hasConflict={conflict}
				{dataFetchedAt}
				{onRefresh}
				refreshStatus={refreshStatuses.get(competition.id) ?? null}
			/>
		{/each}
	</div>
{/if}
