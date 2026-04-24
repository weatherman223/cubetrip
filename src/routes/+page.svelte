<script lang="ts">
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { CompFlightData } from '$lib/types';
	import { retryUnknownComps } from '$lib/utils/wcif-retry';
	import {
		fetchFlightsForCompetitions,
		searchFlightsForComp,
		isFlightLate
	} from '$lib/utils/flight-search';
	import { enrichWCIF } from '$lib/utils/enrich-wcif';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import CompetitionList from '$lib/components/CompetitionList.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import EventFilter from '$lib/components/EventFilter.svelte';
	import SortControl from '$lib/components/SortControl.svelte';
	import PreferencesModal from '$lib/components/PreferencesModal.svelte';
	import SearchHero from '$lib/components/SearchHero.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import LoadingProgress from '$lib/components/LoadingProgress.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { haversine, haversineMiles } from '$lib/utils/distance';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	import { toYMD } from '$lib/utils/dates';

	const today = new Date();
	const twoWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);

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
	let startDate = $state(toYMD(today));
	let endDate = $state(toYMD(twoWeeks));
	let hasSearched = $state(false);
	let showClosed = $state(urlState.closed === '1');
	let allowPartial = $state(
		urlState.partial !== null ? urlState.partial === '1' : preferences.current.allowPartialDefault
	);
	let showPreferences = $state(false);
	let viewMode = $state<'list' | 'map'>(urlState.view === 'map' ? 'map' : 'list');
	let sortBy = $state<'cost' | 'distance' | 'date' | 'name'>(urlState.sort ?? 'date');
	let selectedEvents = urlState.events
		? new SvelteSet(urlState.events.split(',').filter(Boolean))
		: new SvelteSet(preferences.current.defaultEvents);
	let flights = new SvelteMap<string, CompFlightData>();
	let flightDayProgress = new SvelteMap<string, { daysCompleted: number; totalDays: number }>();
	let flightsLoading = $state(false);
	let frozenCostOrder = $state<Map<string, number> | null>(null);
	let dataFetchedAt: string | null = $state(null);
	let refreshStatuses = new SvelteMap<string, 'wcif' | 'flights' | 'done' | 'partial' | 'error'>();

	// Sync state to URL params
	$effect(() => {
		if (typeof window === 'undefined' || !hasSearched) return;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- computed inside effect, not reactive state
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
		if (selectedEvents.has(eventId)) {
			selectedEvents.delete(eventId);
		} else {
			selectedEvents.add(eventId);
		}
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

	// Trigger retry for STATUS UNKNOWN competitions. We key on competition IDs so
	// the effect only fires once per search, not on every in-place wcif mutation
	// from the retry's onUpdate. A generation counter discards stale callbacks
	// when a new search starts mid-retry (otherwise a late onUpdate from the
	// previous search would clobber the current competitions array).
	let retryKey = '';
	let retryGeneration = 0;
	// Tracks whether WCIF retries are currently running. Used to hide the WCIF
	// progress bar once retries exhaust (some comps legitimately have no WCIF,
	// so wcifLoaded < wcifTotal is a permanent state, not an in-flight one).
	let wcifRetriesInFlight = $state(false);

	$effect(() => {
		if (!hasSearched || competitions.length === 0) return;
		const key = competitions.map((c) => c.id).join(',');
		if (key === retryKey) return;
		retryKey = key;
		const hasUnknown = competitions.some((c) => c.wcif === null);
		if (!hasUnknown) return;
		const gen = ++retryGeneration;
		wcifRetriesInFlight = true;
		retryUnknownComps(competitions, (updated) => {
			if (gen === retryGeneration) competitions = updated;
		}).finally(() => {
			if (gen === retryGeneration) wcifRetriesInFlight = false;
		});
	});

	// Compute distance from the CLOSEST home airport (primary + additionals).
	// A comp is "driveable" if any of the user's homes can reach it; the DISTANCE
	// display reflects the nearest one. Single-home users keep today's behavior.
	const distances = $derived.by(() => {
		const prefs = preferences.current;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- computed fresh each derivation, never mutated after
		const map = new Map<string, number>();
		if (prefs.homeLatitude === null || prefs.homeLongitude === null) return map;

		const distFn = prefs.unit === 'km' ? haversine : haversineMiles;
		const origins: Array<{ lat: number; lng: number }> = [
			{ lat: prefs.homeLatitude, lng: prefs.homeLongitude },
			...prefs.additionalHomeAirports.map((a) => ({ lat: a.latitude, lng: a.longitude }))
		];
		for (const c of competitions) {
			let min = Infinity;
			for (const o of origins) {
				const d = distFn(o.lat, o.lng, c.latitude_degrees, c.longitude_degrees);
				if (d < min) min = d;
			}
			map.set(c.id, min);
		}
		return map;
	});

	const DRIVE_COST_PER_MILE = 0.2;
	const KM_PER_MILE = 1.60934;

	/** Estimate travel cost for sorting: drive=$0.20/mi, flight=price, unknown=Infinity */
	function getTravelCost(comp: EnrichedCompetition): number {
		const dist = distances.get(comp.id);
		const driveableRad = preferences.current.driveableRadius;
		if (dist !== undefined && dist <= driveableRad) {
			// dist is in the user's chosen unit; convert to miles for cost estimate
			const miles = preferences.current.unit === 'km' ? dist / KM_PER_MILE : dist;
			return miles * DRIVE_COST_PER_MILE;
		}
		const flightData = flights.get(comp.id);
		if (flightData?.primary?.flight) {
			return flightData.primary.flight.price;
		}
		return Infinity;
	}

	// Fetch flights for non-driveable competitions
	let flightFetchKey = $state('');
	let flightGeneration = 0;

	// Trigger flight fetching when competitions, home airports, or max-days-before change.
	// Gated on !wcifRetriesInFlight so WCIF status (for the closed-comp deferral) is
	// known by the time we start searching. Effect declaration order puts the WCIF
	// retry effect first, so it sets the flag true synchronously before this runs.
	$effect(() => {
		const prefs = preferences.current;
		const additionalIatas = prefs.additionalHomeAirports.map((a) => a.iata).join(',');
		const key = `${competitions.map((c) => c.id).join(',')}:${prefs.homeAirport}:${additionalIatas}:${prefs.maxDaysBeforeComp}:${prefs.skipClosedFlights}`;
		if (
			key !== flightFetchKey &&
			competitions.length > 0 &&
			prefs.homeAirport &&
			!wcifRetriesInFlight
		) {
			flightFetchKey = key;
			const gen = ++flightGeneration;
			// Snapshot current cost-sort order before loading begins
			if (sortBy === 'cost') {
				const order = new Map<string, number>();
				const sorted = [...competitions].sort((a, b) => getTravelCost(a) - getTravelCost(b));
				sorted.forEach((c, i) => order.set(c.id, i));
				frozenCostOrder = order;
			}

			flightsLoading = true;
			flightDayProgress.clear();
			const homeAirports = [prefs.homeAirport, ...prefs.additionalHomeAirports.map((a) => a.iata)];
			fetchFlightsForCompetitions(
				competitions,
				homeAirports,
				distances,
				prefs.driveableRadius,
				(updated) => {
					// Discard stale results if a newer search has started
					if (gen === flightGeneration) {
						for (const [k, v] of updated) flights.set(k, v);
					}
				},
				preferences.current.maxDaysBeforeComp,
				(compId, daysCompleted, totalDays) => {
					if (gen === flightGeneration) {
						flightDayProgress.set(compId, { daysCompleted, totalDays });
					}
				},
				prefs.skipClosedFlights
			).then(() => {
				if (gen === flightGeneration) {
					flightsLoading = false;
					frozenCostOrder = null;
					flightDayProgress.clear();
				}
			});
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
					c.wcif.registrationStatus === 'on-the-spot' ||
					c.wcif.registrationStatus === 'not-open-yet'
			);
		}

		if (selectedEvents.size > 0) {
			result = result.filter((c) => c.event_ids.some((e) => selectedEvents.has(e)));
		}

		// Filter out flights with schedule conflicts unless partial attendance is allowed
		if (!allowPartial) {
			result = result.filter((c) => {
				const primary = flights.get(c.id)?.primary;
				if (!primary) return true;
				return !isFlightLate(primary.flight, c, primary.daysBefore);
			});
		}

		// Sort based on selected sort option
		result = [...result].sort((a, b) => {
			switch (sortBy) {
				case 'cost': {
					if (frozenCostOrder) {
						return (
							(frozenCostOrder.get(a.id) ?? Infinity) - (frozenCostOrder.get(b.id) ?? Infinity)
						);
					}
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

	// Progress counters for the sticky strip. Both streams already push updates via
	// existing callbacks (retryUnknownComps → competitions reassignment, fetchFlights
	// → flights.set), so these derivations react without extra wiring.
	const wcifLoaded = $derived(competitions.filter((c) => c.wcif !== null).length);
	const wcifTotal = $derived(competitions.length);
	const nonDriveableCount = $derived(
		competitions.filter((c) => {
			const dist = distances.get(c.id);
			return dist === undefined || dist > preferences.current.driveableRadius;
		}).length
	);
	const flightsResolved = $derived(flights.size);
	const flightModeSubtitle = $derived(
		preferences.current.maxDaysBeforeComp === 1
			? 'Checking day-before flights (auto-widens if needed)'
			: `Checking 1–${preferences.current.maxDaysBeforeComp} days before`
	);

	async function searchCompetitions(start: string, end: string) {
		// Client-side date range validation (server also enforces 90 days)
		const diffDays =
			(new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) /
			(1000 * 60 * 60 * 24);
		if (diffDays > 90) {
			error = 'Date range too large. Maximum span is 90 days.';
			return;
		}
		if (diffDays < 0) {
			error = 'End date must be after start date.';
			return;
		}

		hasSearched = true;
		loading = true;
		error = null;
		flights.clear();
		flightDayProgress.clear();
		flightFetchKey = '';
		// Invalidate any in-flight WCIF retry from the previous search so its late
		// onUpdate callbacks can't clobber the new competitions array.
		retryGeneration++;
		retryKey = '';
		wcifRetriesInFlight = false;
		try {
			const res = await fetch(`/api/competitions?start=${start}&end=${end}`);
			if (!res.ok) {
				let msg = `Request failed (${res.status})`;
				try {
					const body = await res.json();
					if (body.error) msg = body.error;
				} catch {
					// Non-JSON error response (e.g. proxy HTML page) — use status text
				}
				throw new Error(msg);
			}
			const body = await res.json();
			competitions = body.competitions;
			dataFetchedAt = body.fetchedAt ?? new Date().toISOString();
			startDate = start;
			endDate = end;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function setRefreshStatus(
		compId: string,
		status: 'wcif' | 'flights' | 'done' | 'partial' | 'error' | null
	) {
		if (status === null) {
			refreshStatuses.delete(compId);
		} else {
			refreshStatuses.set(compId, status);
		}
	}

	async function refreshCompetition(compId: string) {
		let wcifFailed = false;
		let flightsFailed = false;

		// Step 1: WCIF
		setRefreshStatus(compId, 'wcif');
		try {
			const wcifRes = await fetch(`/api/wcif/${encodeURIComponent(compId)}?nocache=1`);
			if (wcifRes.ok) {
				const { wcif } = await wcifRes.json();
				const comp = competitions.find((c) => c.id === compId);
				if (comp && wcif) {
					comp.wcif = enrichWCIF(comp.cancelled_at, wcif);
					competitions = [...competitions];
				}
			} else {
				wcifFailed = true;
			}
		} catch {
			wcifFailed = true;
		}

		// Step 2: Flights
		setRefreshStatus(compId, 'flights');
		try {
			const comp = competitions.find((c) => c.id === compId);
			if (comp && preferences.current.homeAirport) {
				const dist = distances.get(compId);
				const isDriveable = dist !== undefined && dist <= preferences.current.driveableRadius;
				if (!isDriveable) {
					const homeAirports = [
						preferences.current.homeAirport,
						...preferences.current.additionalHomeAirports.map((a) => a.iata)
					];
					const result = await searchFlightsForComp(
						comp,
						homeAirports,
						preferences.current.maxDaysBeforeComp,
						true
					);
					flights.set(compId, result);
				}
			}
		} catch {
			flightsFailed = true;
		}

		// Step 3: Determine final status
		dataFetchedAt = new Date().toISOString();
		const finalStatus =
			wcifFailed && flightsFailed ? 'error' : wcifFailed || flightsFailed ? 'partial' : 'done';
		setRefreshStatus(compId, finalStatus);

		// Clear the status after the fade animation
		setTimeout(() => setRefreshStatus(compId, null), 2500);
	}

	function goHome() {
		hasSearched = false;
		competitions = [];
		flights.clear();
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

			<!-- Progress bars (auto-hide when complete). The WCIF bar hides both
				when all records loaded AND when retries exhaust — some comps
				legitimately have no WCIF (newly announced, setup pending), and
				leaving the bar at "57/73" forever looks like a hang. -->
			{#if wcifRetriesInFlight && wcifTotal > 0 && wcifLoaded < wcifTotal}
				<LoadingProgress label="WCIF RECORDS" current={wcifLoaded} total={wcifTotal} />
			{/if}
			{#if flightsLoading && nonDriveableCount > 0}
				<LoadingProgress
					label="FLIGHT FARES"
					current={Math.min(flightsResolved, nonDriveableCount)}
					total={nonDriveableCount}
					subtitle={flightModeSubtitle}
				/>
			{/if}

			<!-- Sort + view toggle row -->
			<div class="flex flex-wrap items-center justify-between gap-2">
				<SortControl
					currentSort={sortBy}
					onSort={(s) => (sortBy = s as typeof sortBy)}
					{flightsLoading}
				/>

				<div
					class="inline-flex rounded-lg border border-airline-slate/40 bg-airline-midnight p-0.5"
				>
					<button
						aria-pressed={viewMode === 'list'}
						onclick={() => (viewMode = 'list')}
						class="cursor-pointer rounded-md px-3 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all
							{viewMode === 'list'
							? 'bg-airline-amber text-airline-midnight'
							: 'text-airline-slate-light hover:text-white'}"
					>
						LIST
					</button>
					<button
						aria-pressed={viewMode === 'map'}
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
	<main id="main-content" class="mx-auto max-w-5xl px-4 py-8">
		<p role="status" class="mb-6 font-mono text-xs tracking-wider text-airline-slate-light">
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
				additionalHomeAirports={preferences.current.additionalHomeAirports}
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
				{flightDayProgress}
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
