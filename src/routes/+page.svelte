<script lang="ts">
	import type { EnrichedCompetition, WCIFPublicData } from '$lib/server/wca/types';
	import type { FlightSearchResult } from '$lib/server/flights/types';
	import type { AirportFlight, CompFlightData } from '$lib/types';
	import { enrichWCIF } from '$lib/utils/enrich-wcif';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import CompetitionList from '$lib/components/CompetitionList.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import EventFilter from '$lib/components/EventFilter.svelte';
	import SortControl from '$lib/components/SortControl.svelte';
	import PreferencesModal from '$lib/components/PreferencesModal.svelte';
	import SearchHero from '$lib/components/SearchHero.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { haversine, haversineMiles } from '$lib/utils/distance';
	import { findNearestAirports } from '$lib/utils/airport-lookup';

	const { data } = $props();

	function shiftDate(dateStr: string, days: number): string {
		const d = new Date(dateStr + 'T00:00:00');
		d.setDate(d.getDate() + days);
		return d.toISOString().split('T')[0];
	}

	// Read initial state from URL params
	function readUrlState() {
		if (typeof window === 'undefined') return {};
		const p = new URLSearchParams(window.location.search);
		return {
			sort: p.get('sort') as 'cost' | 'distance' | 'date' | 'name' | null,
			view: p.get('view') as 'list' | 'map' | null,
			events: p.get('events'),
			closed: p.get('closed'),
			partial: p.get('partial')
		};
	}
	const urlState = readUrlState();

	let competitions: EnrichedCompetition[] = $state([]);
	let startDate = $state(data.start);
	let endDate = $state(data.end);
	let hasSearched = $state(false);
	let showClosed = $state(urlState.closed === '1');
	let allowPartial = $state(
		urlState.partial !== null ? urlState.partial === '1' : preferences.current.allowPartialDefault
	);
	let showPreferences = $state(false);
	let viewMode = $state<'list' | 'map'>(urlState.view === 'map' ? 'map' : 'list');
	let sortBy = $state<'cost' | 'distance' | 'date' | 'name'>(urlState.sort ?? 'date');
	let selectedEvents: Set<string> = $state(
		urlState.events
			? new Set(urlState.events.split(',').filter(Boolean))
			: new Set(preferences.current.defaultEvents)
	);
	let flights: Map<string, CompFlightData> = $state(new Map());
	let flightsLoading = $state(false);
	let dataFetchedAt: string | null = $state(null);
	let refreshStatuses: Map<string, 'wcif' | 'flights' | 'done'> = $state(new Map());

	// Sync state to URL params
	$effect(() => {
		if (typeof window === 'undefined' || !hasSearched) return;
		const p = new URLSearchParams();
		if (startDate) p.set('start', startDate);
		if (endDate) p.set('end', endDate);
		if (sortBy !== 'date') p.set('sort', sortBy);
		if (viewMode !== 'list') p.set('view', viewMode);
		if (selectedEvents.size > 0) p.set('events', [...selectedEvents].join(','));
		if (showClosed) p.set('closed', '1');
		if (allowPartial) p.set('partial', '1');
		const qs = p.toString();
		const newUrl = qs ? `?${qs}` : window.location.pathname;
		history.replaceState(null, '', newUrl);
	});

	function toggleEvent(eventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(eventId)) {
			next.delete(eventId);
		} else {
			next.add(eventId);
		}
		selectedEvents = next;
	}

	// Auto-search if URL has start param (shared link)
	$effect(() => {
		if (typeof window === 'undefined') return;
		const p = new URLSearchParams(window.location.search);
		const urlStart = p.get('start');
		const urlEnd = p.get('end');
		if (urlStart && urlEnd && !hasSearched) {
			startDate = urlStart;
			endDate = urlEnd;
			searchCompetitions(urlStart, urlEnd);
		}
	});

	let loading = $state(false);
	let error: string | null = $state(null);

	async function retryUnknownComps() {
		const unknown = competitions.filter((c) => c.wcif === null);
		if (unknown.length === 0) return;

		const MAX_RETRIES = 5;
		let attempt = 0;
		let remaining = unknown.map((c) => c.id);

		while (remaining.length > 0 && attempt < MAX_RETRIES) {
			attempt++;
			const delay = Math.min(2000 * 2 ** (attempt - 1), 30000);
			await new Promise((r) => setTimeout(r, delay));

			const stillFailing: string[] = [];

			for (const id of remaining) {
				try {
					const res = await fetch(`/api/wcif?id=${encodeURIComponent(id)}`);
					if (!res.ok) {
						stillFailing.push(id);
						continue;
					}
					const { wcif } = (await res.json()) as { wcif: WCIFPublicData };
					const comp = competitions.find((c) => c.id === id);
					if (comp) {
						comp.wcif = enrichWCIF(comp.cancelled_at, wcif);
						competitions = [...competitions]; // trigger reactivity
					}
				} catch {
					stillFailing.push(id);
				}
			}

			remaining = stillFailing;
		}
	}

	// Trigger retry for STATUS UNKNOWN competitions
	$effect(() => {
		if (hasSearched && competitions.length > 0) {
			const hasUnknown = competitions.some((c) => c.wcif === null);
			if (hasUnknown) {
				retryUnknownComps();
			}
		}
	});

	// Compute distances from home airport
	const distances = $derived.by(() => {
		const prefs = preferences.current;
		const map = new Map<string, number>();
		if (prefs.homeLatitude === null || prefs.homeLongitude === null) return map;

		const distFn = prefs.unit === 'km' ? haversine : haversineMiles;
		for (const c of competitions) {
			map.set(
				c.id,
				distFn(prefs.homeLatitude, prefs.homeLongitude, c.latitude_degrees, c.longitude_degrees)
			);
		}
		return map;
	});

	const hasHome = $derived(preferences.current.homeAirport !== null);

	/** Estimate travel cost for sorting: drive=$0.20/mi, flight=price, unknown=Infinity */
	function getTravelCost(comp: EnrichedCompetition): number {
		const dist = distances.get(comp.id);
		const driveableRad = preferences.current.driveableRadius;
		if (dist !== undefined && dist <= driveableRad) {
			return dist * 0.2; // $0.20/mile gas estimate
		}
		const flightData = flights.get(comp.id);
		if (flightData?.primary?.flight) {
			return flightData.primary.flight.price;
		}
		return Infinity;
	}

	// Fetch flights for non-driveable competitions
	let flightFetchKey = $state('');

	interface FlightApiResponse extends FlightSearchResult {
		fallbackUrl?: string;
	}

	async function fetchFlightForAirport(
		homeAirport: string,
		destIata: string,
		departDate: string,
		returnDate: string,
		nocache = false
	): Promise<AirportFlight | null> {
		try {
			const cacheParam = nocache ? '&nocache=1' : '';
			const res = await fetch(
				`/api/flights?origin=${homeAirport}&destination=${destIata}&departDate=${departDate}&returnDate=${returnDate}${cacheParam}`
			);
			if (!res.ok) return null;
			const data: FlightApiResponse = await res.json();
			if (data.flights.length === 0) return null;
			return {
				flight: data.flights[0],
				fetchedAt: data.fetchedAt,
				fallbackUrl: data.fallbackUrl ?? null
			};
		} catch {
			return null;
		}
	}

	const INITIAL_AIRPORT_COUNT = 5;
	const MAX_AIRPORT_COUNT = 20;

	async function searchFlightsForComp(
		comp: EnrichedCompetition,
		homeAirport: string,
		nocache = false
	): Promise<CompFlightData> {
		const dayBefore = shiftDate(comp.start_date, -1);
		const dayAfter = shiftDate(comp.end_date, 1);
		const allNearby = findNearestAirports(
			comp.latitude_degrees,
			comp.longitude_degrees,
			MAX_AIRPORT_COUNT
		).filter((a) => a.airport.iata !== homeAirport);

		// Start with first 5, expand if none have flights
		let searched = 0;
		const allResults: NonNullable<Awaited<ReturnType<typeof fetchFlightForAirport>>>[] = [];
		let fallbackUrl: string | null = null;

		while (searched < allNearby.length && allResults.length === 0) {
			const chunk = allNearby.slice(searched, searched + INITIAL_AIRPORT_COUNT);
			const results = await Promise.all(
				chunk.map((a) =>
					fetchFlightForAirport(homeAirport, a.airport.iata, dayBefore, dayAfter, nocache)
				)
			);
			for (const r of results) {
				if (r) {
					allResults.push(r);
					if (!fallbackUrl) fallbackUrl = r.fallbackUrl;
				}
			}
			searched += INITIAL_AIRPORT_COUNT;
		}

		if (allResults.length === 0) {
			return { primary: null, cheaperAlt: null, fallbackUrl };
		}

		const primary: AirportFlight = {
			flight: allResults[0].flight,
			fetchedAt: allResults[0].fetchedAt,
			fallbackUrl: allResults[0].fallbackUrl
		};

		let cheaperAlt: AirportFlight | null = null;
		const cheaperFarther = allResults
			.slice(1)
			.filter(
				(r) =>
					r.flight.price < allResults[0].flight.price &&
					r.flight.destination !== allResults[0].flight.destination
			)
			.sort((a, b) => a.flight.price - b.flight.price)[0];
		if (cheaperFarther) {
			cheaperAlt = {
				flight: cheaperFarther.flight,
				fetchedAt: cheaperFarther.fetchedAt,
				fallbackUrl: cheaperFarther.fallbackUrl
			};
		}

		return { primary, cheaperAlt, fallbackUrl };
	}

	async function fetchFlightsForCompetitions(
		comps: EnrichedCompetition[],
		homeAirport: string,
		radius: number
	) {
		const nonDriveable = comps.filter((c) => {
			const dist = distances.get(c.id);
			return dist === undefined || dist > radius;
		});

		flightsLoading = true;
		const newFlights = new Map<string, CompFlightData>();
		const BATCH_SIZE = 3;

		for (let i = 0; i < nonDriveable.length; i += BATCH_SIZE) {
			const batch = nonDriveable.slice(i, i + BATCH_SIZE);
			await Promise.allSettled(
				batch.map(async (comp) => {
					const result = await searchFlightsForComp(comp, homeAirport);
					newFlights.set(comp.id, result);
				})
			);
			flights = new Map(newFlights);
		}
		flightsLoading = false;
	}

	// Trigger flight fetching when competitions or home airport change
	$effect(() => {
		const key = `${competitions.map((c) => c.id).join(',')}:${preferences.current.homeAirport}`;
		if (key !== flightFetchKey && competitions.length > 0 && preferences.current.homeAirport) {
			flightFetchKey = key;
			fetchFlightsForCompetitions(
				competitions,
				preferences.current.homeAirport,
				preferences.current.driveableRadius
			);
		}
	});

	// Filter + sort
	const filteredCompetitions = $derived.by(() => {
		let result = competitions;

		if (!showClosed) {
			result = result.filter(
				(c) =>
					c.wcif === null ||
					c.wcif.registrationStatus === 'open' ||
					c.wcif.registrationStatus === 'waitlist' ||
					c.wcif.registrationStatus === 'on-the-spot'
			);
		}

		if (selectedEvents.size > 0) {
			result = result.filter((c) => c.event_ids.some((e) => selectedEvents.has(e)));
		}

		// Filter out flights with schedule conflicts unless partial attendance is allowed
		if (!allowPartial) {
			result = result.filter((c) => {
				const flightData = flights.get(c.id);
				const flight = flightData?.primary?.flight;
				const compStart = c.wcif?.scheduleStartTime;
				if (!flight || !compStart || !flight.arrivalTime) return true;
				return flight.arrivalTime <= compStart;
			});
		}

		// Sort based on selected sort option
		result = [...result].sort((a, b) => {
			switch (sortBy) {
				case 'cost': {
					const costA = getTravelCost(a);
					const costB = getTravelCost(b);
					return costA - costB;
				}
				case 'distance': {
					const da = distances.get(a.id) ?? Infinity;
					const db = distances.get(b.id) ?? Infinity;
					return da - db;
				}
				case 'name':
					return a.name.localeCompare(b.name);
				case 'date':
				default:
					return a.start_date.localeCompare(b.start_date);
			}
		});

		return result;
	});

	const closedCount = $derived(
		competitions.filter((c) => c.wcif?.registrationStatus === 'closed').length
	);

	async function searchCompetitions(start: string, end: string) {
		hasSearched = true;
		loading = true;
		error = null;
		flights = new Map();
		flightFetchKey = '';
		try {
			const res = await fetch(`/api/competitions?start=${start}&end=${end}`);
			if (!res.ok) {
				const body = await res.json();
				throw new Error(body.error || `Request failed (${res.status})`);
			}
			const body = await res.json();
			competitions = body.competitions;
			dataFetchedAt = new Date().toISOString();
			startDate = start;
			endDate = end;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function setRefreshStatus(compId: string, status: 'wcif' | 'flights' | 'done' | null) {
		const next = new Map(refreshStatuses);
		if (status === null) {
			next.delete(compId);
		} else {
			next.set(compId, status);
		}
		refreshStatuses = next;
	}

	async function refreshCompetition(compId: string) {
		// Step 1: WCIF
		setRefreshStatus(compId, 'wcif');
		try {
			const wcifRes = await fetch(`/api/wcif?id=${encodeURIComponent(compId)}&nocache=1`);
			if (wcifRes.ok) {
				const { wcif } = await wcifRes.json();
				const comp = competitions.find((c) => c.id === compId);
				if (comp && wcif) {
					comp.wcif = enrichWCIF(comp.cancelled_at, wcif);
					competitions = [...competitions];
				}
			}
		} catch {
			// Continue to flights even if WCIF fails
		}

		// Step 2: Flights
		setRefreshStatus(compId, 'flights');
		try {
			const comp = competitions.find((c) => c.id === compId);
			if (comp && preferences.current.homeAirport) {
				const dist = distances.get(compId);
				const isDriveable = dist !== undefined && dist <= preferences.current.driveableRadius;
				if (!isDriveable) {
					const result = await searchFlightsForComp(
						comp,
						preferences.current.homeAirport,
						true
					);
					const newFlights = new Map(flights);
					newFlights.set(compId, result);
					flights = newFlights;
				}
			}
		} catch {
			// Flight refresh failed — not critical
		}

		// Step 3: Done
		dataFetchedAt = new Date().toISOString();
		setRefreshStatus(compId, 'done');

		// Clear the "done" status after the fade animation
		setTimeout(() => setRefreshStatus(compId, null), 2500);
	}

	function goHome() {
		hasSearched = false;
		competitions = [];
		flights = new Map();
		flightFetchKey = '';
		if (typeof window !== 'undefined') {
			history.replaceState(null, '', window.location.pathname);
		}
	}

	function handleRetry() {
		searchCompetitions(startDate, endDate);
	}
</script>

{#if !hasSearched}
	<SearchHero onSearch={searchCompetitions} onOpenSettings={() => (showPreferences = true)} />
{:else if loading && competitions.length === 0}
	<LoadingScreen />
{:else}
	<!-- Header -->
	<header class="border-b border-airline-slate/30 px-4 py-6">
		<div class="mx-auto max-w-5xl">
			<div class="flex items-center justify-between">
				<button
					onclick={goHome}
					class="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
				>
					<span class="text-3xl">✈</span>
					<div class="text-left">
						<h1 class="text-2xl font-bold tracking-tight">CubeTrip</h1>
						<p class="font-mono text-xs tracking-[0.3em] text-airline-amber uppercase">
							DEPARTURES
						</p>
					</div>
				</button>
				<button
					onclick={() => (showPreferences = true)}
					class="flex cursor-pointer items-center gap-2 rounded-lg border border-airline-slate/40 px-3 py-2 font-mono text-[10px] tracking-widest text-airline-slate-light uppercase transition-colors hover:border-airline-amber/50 hover:text-airline-amber"
				>
					⚙ SETTINGS
				</button>
			</div>
		</div>
	</header>

	<!-- Controls -->
	<section
		class="sticky top-0 z-30 border-b border-airline-slate/20 bg-airline-midnight/90 px-4 py-4 backdrop-blur"
	>
		<div class="mx-auto max-w-5xl space-y-3">
			<DateRangePicker {startDate} {endDate} onSearch={searchCompetitions} {loading} />

			<!-- Event filter chips -->
			<EventFilter {selectedEvents} onToggle={toggleEvent} />

			<!-- Filter toggle bar -->
			<div class="flex items-center justify-between">
				<label class="group flex cursor-pointer items-center gap-2.5">
					<div class="toggle-track relative">
						<input type="checkbox" bind:checked={showClosed} class="peer sr-only" />
						<div
							class="h-5 w-9 rounded-full bg-airline-slate transition-colors peer-checked:bg-airline-amber"
						></div>
						<div
							class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
						></div>
					</div>
					<span
						class="font-mono text-[10px] tracking-widest text-airline-slate-light uppercase transition-colors group-hover:text-white"
					>
						SHOW ALL DEPARTURES
					</span>
					{#if closedCount > 0 && !showClosed}
						<span
							class="rounded-full bg-airline-slate/40 px-2 py-px font-mono text-[9px] text-airline-slate-light"
						>
							+{closedCount} HIDDEN
						</span>
					{/if}
				</label>
				<div class="flex flex-wrap items-center gap-3">
					<label class="group flex cursor-pointer items-center gap-2">
						<div class="toggle-track relative">
							<input type="checkbox" bind:checked={allowPartial} class="peer sr-only" />
							<div
								class="h-5 w-9 rounded-full bg-airline-slate transition-colors peer-checked:bg-airline-amber-dark"
							></div>
							<div
								class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
							></div>
						</div>
						<span
							class="font-mono text-[10px] tracking-widest text-airline-slate-light uppercase transition-colors group-hover:text-white"
						>
							ALLOW PARTIAL
						</span>
					</label>
				</div>
			</div>

			<!-- Sort + view toggle row -->
			<div class="flex flex-wrap items-center justify-between gap-2">
				<SortControl currentSort={sortBy} onSort={(s) => (sortBy = s as typeof sortBy)} />

				<div
					class="inline-flex rounded-lg border border-airline-slate/40 bg-airline-midnight p-0.5"
				>
					<button
						onclick={() => (viewMode = 'list')}
						class="cursor-pointer rounded-md px-3 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all
							{viewMode === 'list'
							? 'bg-airline-amber text-airline-midnight'
							: 'text-airline-slate-light hover:text-white'}"
					>
						LIST
					</button>
					<button
						onclick={() => (viewMode = 'map')}
						class="cursor-pointer rounded-md px-3 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all
							{viewMode === 'map'
							? 'bg-airline-amber text-airline-midnight'
							: 'text-airline-slate-light hover:text-white'}"
					>
						MAP
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Main content -->
	<main class="mx-auto max-w-5xl px-4 py-8">
		<p class="mb-6 font-mono text-xs tracking-wider text-airline-slate-light">
			{filteredCompetitions.length} DEPARTURE{filteredCompetitions.length !== 1 ? 'S' : ''} FOUND
		</p>

		{#if viewMode === 'map'}
			<MapView
				competitions={filteredCompetitions}
				{distances}
				{flights}
				driveableRadius={preferences.current.driveableRadius}
				unit={preferences.current.unit}
				homeLatitude={preferences.current.homeLatitude}
				homeLongitude={preferences.current.homeLongitude}
			/>
		{:else}
			<CompetitionList
				competitions={filteredCompetitions}
				{loading}
				{error}
				onRetry={handleRetry}
				{distances}
				{flights}
				{flightsLoading}
				{dataFetchedAt}
				onRefresh={refreshCompetition}
				{refreshStatuses}
				driveableRadius={preferences.current.driveableRadius}
				unit={preferences.current.unit}
			/>
		{/if}
	</main>
{/if}

<PreferencesModal open={showPreferences} onClose={() => (showPreferences = false)} />

<style>
	.toggle-track {
		display: flex;
		align-items: center;
	}
</style>
