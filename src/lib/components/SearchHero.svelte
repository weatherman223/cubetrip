<script lang="ts">
	import AirportAutocomplete from './AirportAutocomplete.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';

	let {
		onSearch,
		onOpenSettings
	}: {
		onSearch: (start: string, end: string) => void;
		onOpenSettings: () => void;
	} = $props();

	let start = $state('');
	let end = $state('');
	let homeAirport = $state(preferences.current.homeAirport);

	function toYMD(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function getWeekend(weeksAhead: number): { start: string; end: string } {
		const now = new Date();
		const day = now.getDay();
		const daysToSat = ((6 - day + 7) % 7 || 7) + (weeksAhead - 1) * 7;
		const sat = new Date(now);
		sat.setDate(now.getDate() + daysToSat);
		const sun = new Date(sat);
		sun.setDate(sat.getDate() + 1);
		return { start: toYMD(sat), end: toYMD(sun) };
	}

	function selectWeekend(weeksAhead: number) {
		const wk = getWeekend(weeksAhead);
		start = wk.start;
		end = wk.end;
	}

	function handleAirportSelect(airport: { iata: string; latitude: number; longitude: number }) {
		homeAirport = airport.iata;
		preferences.update({
			homeAirport: airport.iata,
			homeLatitude: airport.latitude,
			homeLongitude: airport.longitude
		});
	}

	function handleSearch() {
		if (start && end && end >= start) {
			onSearch(start, end);
		}
	}
</script>

<div
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
			<div class="mb-5">
				<p class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase">
					HOME AIRPORT
				</p>
				<AirportAutocomplete value={homeAirport} onSelect={handleAirportSelect} />
			</div>

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
						class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2.5 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
					/>
				</div>
			</div>

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
</div>

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
