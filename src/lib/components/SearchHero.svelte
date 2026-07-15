<script lang="ts">
	import AirportAutocomplete from './AirportAutocomplete.svelte';
	import DistanceLimitSlider from './DistanceLimitSlider.svelte';
	import CountryFilter from './CountryFilter.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { findNearbyAirports } from '$lib/utils/airport-lookup';
	import type { Airport } from '$lib/types';
	import { getWeekend } from '$lib/utils/dates';

	let {
		onSearch,
		onOpenSettings,
		error = null
	}: {
		onSearch: (start: string, end: string) => void;
		onOpenSettings: () => void;
		error?: string | null;
	} = $props();

	let start = $state('');
	let end = $state('');

	// Server-enforced cap is 90 days; constrain the picker so the range can't
	// silently fail validation after submit.
	const maxEnd = $derived.by(() => {
		if (!start) return undefined;
		const [y, m, d] = start.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d + 90)).toISOString().split('T')[0];
	});

	let homeAirport = $state(preferences.current.homeAirport);
	let homeLat = $state(preferences.current.homeLatitude);
	let homeLng = $state(preferences.current.homeLongitude);
	let additionalOrigins = $state<Airport[]>([...preferences.current.additionalHomeAirports]);
	// Remount the "add more" autocomplete on each pick so it clears cleanly.
	let addOriginKey = $state(0);
	// Collapsed by default once the user has picked at least one — keeps the hero tight.
	let showAdd = $state(false);

	// Travel filters (distance limit + country/continent allowlist) live in their
	// own collapsible section so the hero stays compact for users who don't need them.
	let showTravelFilters = $state(false);

	function selectWeekend(weeksAhead: number) {
		const wk = getWeekend(weeksAhead);
		start = wk.start;
		end = wk.end;
	}

	function handleAirportSelect(airport: { iata: string; latitude: number; longitude: number }) {
		homeAirport = airport.iata;
		homeLat = airport.latitude;
		homeLng = airport.longitude;
		// Clear any additional origin that collides with the new primary.
		additionalOrigins = additionalOrigins.filter((a) => a.iata !== airport.iata);
		preferences.update({
			homeAirport: airport.iata,
			homeLatitude: airport.latitude,
			homeLongitude: airport.longitude,
			additionalHomeAirports: additionalOrigins
		});
	}

	// Suggest up to 4 nearby airports within 120 km, excluding the primary and
	// anything already added. 4 (not 5 like the modal) keeps the hero layout tight.
	const suggestedOrigins = $derived.by(() => {
		if (homeLat === null || homeLng === null) return [] as Airport[];
		const exclude = [homeAirport, ...additionalOrigins.map((a) => a.iata)].filter(
			(x): x is string => typeof x === 'string'
		);
		return findNearbyAirports(homeLat, homeLng, 120, exclude).slice(0, 4);
	});

	function addOrigin(airport: Airport) {
		if (airport.iata === homeAirport) return;
		if (additionalOrigins.some((a) => a.iata === airport.iata)) return;
		additionalOrigins = [...additionalOrigins, airport];
		addOriginKey++;
		showAdd = false;
		preferences.update({ additionalHomeAirports: additionalOrigins });
	}

	function removeOrigin(iata: string) {
		additionalOrigins = additionalOrigins.filter((a) => a.iata !== iata);
		preferences.update({ additionalHomeAirports: additionalOrigins });
	}

	function handleSearch() {
		if (start && end && end >= start) {
			onSearch(start, end);
		}
	}

	// Heads-up shown when the search is likely to take a while: 3+ origins multiply
	// the per-comp probe count, and a 3+ week date range pulls many more comps. Either
	// alone is noticeable; both together really stack up. Pure derivation, no toggle.
	const totalOrigins = $derived((homeAirport ? 1 : 0) + additionalOrigins.length);
	const rangeWeeks = $derived.by(() => {
		if (!start || !end || end < start) return 0;
		const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
		return ms / (7 * 24 * 60 * 60 * 1000);
	});
	const slowReasons = $derived.by(() => {
		const reasons: string[] = [];
		if (totalOrigins >= 3) reasons.push(`${totalOrigins} origin airports`);
		if (rangeWeeks >= 3) reasons.push(`a ${Math.round(rangeWeeks)}-week range`);
		return reasons;
	});
</script>

<!-- <main id="main-content"> keeps the layout skip-link functional on the hero;
	only one of the hero / loading / results branches renders at a time, so the
	id stays unique. -->
<main
	id="main-content"
	class="hero-container relative flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-16"
>
	<!-- Background atmosphere -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		<div
			class="radar-sweep absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03]"
		></div>
		<div
			class="absolute top-[20%] left-[10%] h-1 w-1 animate-pulse rounded-full bg-airline-amber/20"
		></div>
		<div
			class="absolute top-[60%] right-[15%] h-1 w-1 animate-pulse rounded-full bg-airline-sky/20"
			style="animation-delay: 1s"
		></div>
		<div
			class="absolute bottom-[30%] left-[25%] h-0.5 w-0.5 animate-pulse rounded-full bg-airline-amber/15"
			style="animation-delay: 0.5s"
		></div>
		<div
			class="absolute top-[40%] right-[30%] h-0.5 w-0.5 animate-pulse rounded-full bg-airline-sky/15"
			style="animation-delay: 1.5s"
		></div>
	</div>

	<!-- Branding -->
	<div class="hero-brand relative mb-10 text-center">
		<div class="mb-3 text-6xl sm:text-7xl">✈</div>
		<h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl">CubeTrip</h1>
		<p class="mt-2 font-mono text-xs tracking-[0.4em] text-airline-amber uppercase">DEPARTURES</p>
		<p class="mt-4 text-lg text-slate-400 sm:text-xl">Find your next competition</p>
	</div>

	<!-- Search card -->
	<div class="hero-card relative w-full max-w-lg">
		<!-- Settings button -->
		<button
			onclick={onOpenSettings}
			class="absolute -top-10 right-0 cursor-pointer font-mono text-[10px] tracking-widest text-airline-slate-light uppercase transition-colors hover:text-airline-amber"
		>
			⚙ SETTINGS
		</button>

		<div
			class="rounded-2xl border border-airline-slate/30 bg-airline-navy/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm"
		>
			<!-- Home Airport -->
			<div class="mb-4">
				<p
					id="home-airport-label"
					class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase"
				>
					HOME AIRPORT
				</p>
				<AirportAutocomplete
					value={homeAirport}
					onSelect={handleAirportSelect}
					labelledBy="home-airport-label"
				/>
			</div>

			<!-- Also Search From: multi-origin picker. Visible once primary is set so
				users in metros like NYC/LA can immediately add LGA, EWR, BUR, etc.
				before kicking off the search. -->
			{#if homeAirport}
				<div class="mb-5">
					<div class="mb-1.5 flex items-baseline justify-between gap-2">
						<p class="font-mono text-[10px] tracking-widest text-airline-amber uppercase">
							ALSO SEARCH FROM
						</p>
						<span class="font-mono text-[9px] text-slate-500">
							Multi-airport metro? Add nearby origins.
						</span>
					</div>

					<div
						class="mb-2 flex items-start gap-2 rounded-md border border-airline-sky/30 bg-airline-sky/5 px-2 py-1.5"
					>
						<span class="font-mono text-[10px] text-airline-sky" aria-hidden="true">ⓘ</span>
						<p class="font-mono text-[10px] leading-snug text-airline-slate-light">
							<span class="font-semibold text-airline-sky">New —</span> your primary
							<span class="font-bold text-airline-amber">{homeAirport}</span> always shows in the main
							fare slot. Secondaries appear as "Cheaper from …" alternatives only when they undercut it
							on the same route.
						</p>
					</div>

					{#if additionalOrigins.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each additionalOrigins as origin (origin.iata)}
								<span
									class="inline-flex items-center gap-1.5 rounded-full border border-airline-slate bg-airline-midnight px-2 py-0.5 font-mono text-[10px] text-white"
								>
									<span class="font-bold text-airline-amber">{origin.iata}</span>
									<span class="text-slate-400">{origin.city}</span>
									<button
										type="button"
										onclick={() => removeOrigin(origin.iata)}
										aria-label={`Remove ${origin.iata}`}
										class="cursor-pointer text-slate-500 transition-colors hover:text-red-400"
									>
										×
									</button>
								</span>
							{/each}
						</div>
					{/if}

					{#if suggestedOrigins.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each suggestedOrigins as airport (airport.iata)}
								<button
									type="button"
									onclick={() => addOrigin(airport)}
									class="inline-flex cursor-pointer items-center gap-1 rounded-full border border-airline-slate/40 bg-airline-midnight px-2 py-0.5 font-mono text-[10px] text-slate-300 transition-all hover:border-airline-amber hover:text-white"
								>
									<span class="text-airline-amber">+</span>
									<span class="font-bold">{airport.iata}</span>
									<span class="text-slate-400">{airport.city}</span>
								</button>
							{/each}
						</div>
					{/if}

					{#if showAdd}
						{#key addOriginKey}
							<AirportAutocomplete value={null} onSelect={addOrigin} />
						{/key}
					{:else}
						<button
							type="button"
							onclick={() => (showAdd = true)}
							class="cursor-pointer font-mono text-[10px] tracking-widest text-slate-500 uppercase transition-colors hover:text-airline-amber"
						>
							+ ADD ANOTHER AIRPORT
						</button>
					{/if}
				</div>
			{/if}

			<!-- Weekend quick-selects -->
			<div class="mb-4 flex gap-2">
				<button
					type="button"
					onclick={() => selectWeekend(1)}
					class="cursor-pointer rounded-full border border-airline-slate/40 px-4 py-1.5 font-mono text-[10px] tracking-wider text-airline-slate-light transition-all hover:border-airline-amber/50 hover:text-airline-amber"
				>
					THIS WEEKEND
				</button>
				<button
					type="button"
					onclick={() => selectWeekend(2)}
					class="cursor-pointer rounded-full border border-airline-slate/40 px-4 py-1.5 font-mono text-[10px] tracking-wider text-airline-slate-light transition-all hover:border-airline-amber/50 hover:text-airline-amber"
				>
					NEXT WEEKEND
				</button>
			</div>

			<!-- Date inputs -->
			<div class="mb-5 flex gap-4">
				<div class="flex-1">
					<label
						for="hero-start"
						class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
					>
						DEPARTURE FROM
					</label>
					<input
						id="hero-start"
						type="date"
						bind:value={start}
						class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2.5 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
					/>
				</div>
				<div class="flex-1">
					<label
						for="hero-end"
						class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
					>
						RETURN BY
					</label>
					<input
						id="hero-end"
						type="date"
						bind:value={end}
						min={start}
						max={maxEnd}
						class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2.5 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
					/>
				</div>
			</div>

			<!-- Travel filters (collapsible) -->
			<div class="mb-5">
				<button
					type="button"
					onclick={() => (showTravelFilters = !showTravelFilters)}
					aria-expanded={showTravelFilters}
					class="flex w-full cursor-pointer items-center justify-between rounded-lg border border-airline-slate/40 bg-airline-midnight/60 px-3 py-2 font-mono text-[10px] tracking-widest text-airline-slate-light uppercase transition-colors hover:border-airline-amber/50 hover:text-airline-amber"
				>
					<span>TRAVEL FILTERS</span>
					<span class="text-xs">{showTravelFilters ? '−' : '+'}</span>
				</button>
				{#if showTravelFilters}
					<div
						class="mt-3 space-y-4 rounded-lg border border-airline-slate/30 bg-airline-midnight/40 p-3"
					>
						<DistanceLimitSlider
							value={preferences.current.maxDistanceKm}
							unit={preferences.current.unit}
							homeAirportSet={homeAirport !== null}
							onChange={(km) => preferences.update({ maxDistanceKm: km })}
						/>
						<CountryFilter
							selected={preferences.current.allowedCountries}
							onChange={(next) => preferences.update({ allowedCountries: next })}
						/>
					</div>
				{/if}
			</div>

			{#if error}
				<div
					class="mb-3 flex items-start gap-2 rounded-lg border border-airline-cancelled/40 bg-airline-cancelled/10 px-3 py-2"
					role="alert"
				>
					<span class="font-mono text-xs text-airline-cancelled" aria-hidden="true">⚠</span>
					<p class="font-mono text-[10px] leading-snug text-airline-slate-light">
						<span class="text-airline-cancelled">Can't search —</span>
						{error}
					</p>
				</div>
			{/if}

			{#if slowReasons.length > 0}
				<div
					class="mb-3 flex items-start gap-2 rounded-lg border border-airline-amber/30 bg-airline-amber/5 px-3 py-2"
					role="status"
				>
					<span class="font-mono text-xs text-airline-amber" aria-hidden="true">⏱</span>
					<p class="font-mono text-[10px] leading-snug text-airline-slate-light">
						<span class="text-airline-amber">Heads up —</span> searching with {slowReasons.join(
							' and '
						)} can take a few minutes to load.
					</p>
				</div>
			{/if}

			<!-- Search button -->
			<button
				onclick={handleSearch}
				disabled={!start || !end || end < start}
				class="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-airline-amber py-3.5 font-mono text-sm font-bold tracking-wider text-airline-midnight transition-all hover:bg-airline-amber-light hover:shadow-lg hover:shadow-airline-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<span class="text-lg">✈</span>
				SEARCH FLIGHTS
			</button>
		</div>

		<!-- Subtle hint -->
		<p class="mt-4 text-center font-mono text-[10px] text-slate-600">
			Discover WCA competitions you can travel to
		</p>
	</div>
</main>

<style>
	@keyframes hero-fade-in {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.hero-brand {
		animation: hero-fade-in 0.8s ease-out;
	}
	.hero-card {
		animation: hero-fade-in 0.8s ease-out 0.2s both;
	}

	@keyframes radar {
		from {
			transform: translate(-50%, -50%) rotate(0deg);
		}
		to {
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}
	.radar-sweep {
		background: conic-gradient(
			from 0deg,
			transparent 0%,
			var(--color-airline-amber) 10%,
			transparent 20%
		);
		animation: radar 8s linear infinite;
	}
</style>
