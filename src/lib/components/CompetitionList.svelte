<script lang="ts">
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { CompFlightData } from '$lib/types';
	import CompetitionCard from './CompetitionCard.svelte';
	import StatusMessage from './StatusMessage.svelte';
	import { isFlightLate } from '$lib/utils/flight-search';

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
		flightDayProgress = new Map(),
		dataFetchedAt = null,
		onRefresh = null,
		refreshStatuses = new Map(),
		emptyMessage = null
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
		flightDayProgress?: Map<string, { daysCompleted: number; totalDays: number }>;
		dataFetchedAt?: string | null;
		onRefresh?: ((compId: string) => void) | null;
		refreshStatuses?: Map<string, 'wcif' | 'flights' | 'done' | 'partial' | 'error'>;
		/** Override for the zero-results copy — e.g. when filters (not the date
		 * range) are what emptied the list. */
		emptyMessage?: string | null;
	} = $props();
</script>

{#if loading}
	<StatusMessage variant="loading" />
{:else if error}
	<StatusMessage variant="error" message={error} {onRetry} />
{:else if competitions.length === 0}
	<StatusMessage variant="empty" message={emptyMessage ?? undefined} />
{:else}
	<div class="flex flex-col gap-4">
		{#each competitions as competition (competition.id)}
			{@const dist = distances.get(competition.id) ?? null}
			{@const flightData = flights.get(competition.id)}
			{@const isDriveable = dist !== null && dist <= driveableRadius}
			{@const primaryFlight = flightData?.primary ?? null}
			{@const flight = primaryFlight?.flight ?? null}
			{@const conflict = !!(
				primaryFlight && isFlightLate(primaryFlight.flight, competition, primaryFlight.daysBefore)
			)}
			{@const dayProgress = flightDayProgress.get(competition.id) ?? null}
			<CompetitionCard
				{competition}
				distance={dist}
				{isDriveable}
				{unit}
				cheapestFlight={flight}
				flightFetchedAt={flightData?.primary?.fetchedAt ?? null}
				flightDaysBefore={flightData?.primary?.daysBefore ?? null}
				cheaperAltFlight={flightData?.cheaperAlt?.flight ?? null}
				cheaperFromAltFlight={flightData?.cheaperFromAlt?.flight ?? null}
				flightFallbackUrl={flightData?.fallbackUrl ?? null}
				flightLoading={flightsLoading && !isDriveable && !flightData}
				flightDayProgress={dayProgress}
				hasConflict={conflict}
				nearestAirportIata={flightData?.nearestAirportIata ?? null}
				{dataFetchedAt}
				{onRefresh}
				refreshStatus={refreshStatuses.get(competition.id) ?? null}
			/>
		{/each}
	</div>
{/if}
