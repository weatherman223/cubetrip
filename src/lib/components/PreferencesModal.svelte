<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';
	import type { DistanceUnit } from '$lib/stores/preferences.svelte';
	import type { Airport } from '$lib/types';
	import { SvelteSet } from 'svelte/reactivity';
	import AirportAutocomplete from './AirportAutocomplete.svelte';
	import { ALL_EVENT_IDS, EVENT_NAMES } from '$lib/utils/events';
	import { findNearbyAirports } from '$lib/utils/airport-lookup';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	let homeAirport = $state<string | null>(null);
	let homeLat = $state<number | null>(null);
	let homeLng = $state<number | null>(null);
	let additionalOrigins = $state<Airport[]>([]);
	// Bumping this key remounts the "add more" autocomplete so it resets after
	// each pick (its internal $derived query doesn't clear on external value=null).
	let addOriginKey = $state(0);
	let radius = $state(300);
	let unit = $state<DistanceUnit>('miles');
	let defaultEvents = new SvelteSet<string>();
	let allowPartialDefault = $state(false);
	let maxDaysBeforeComp = $state(3);
	let skipClosedFlights = $state(true);

	$effect(() => {
		if (open) {
			clearConfirmPending = false;
			clearTimeout(clearConfirmTimer);
			const p = preferences.current;
			homeAirport = p.homeAirport;
			homeLat = p.homeLatitude;
			homeLng = p.homeLongitude;
			additionalOrigins = [...p.additionalHomeAirports];
			radius = p.driveableRadius;
			unit = p.unit;
			defaultEvents.clear();
			for (const e of p.defaultEvents) defaultEvents.add(e);
			allowPartialDefault = p.allowPartialDefault;
			maxDaysBeforeComp = p.maxDaysBeforeComp;
			skipClosedFlights = p.skipClosedFlights;
		}
	});

	function handleAirportSelect(airport: { iata: string; latitude: number; longitude: number }) {
		homeAirport = airport.iata;
		homeLat = airport.latitude;
		homeLng = airport.longitude;
	}

	// Suggest up to 5 nearby airports (within 120 km) that aren't the primary or
	// already added. 120 km covers multi-airport metros like NYC (JFK/LGA/EWR/HPN/ISP),
	// LA (LAX/BUR/LGB/ONT/SNA), Bay Area (SFO/OAK/SJC), London (LHR/LGW/STN/LTN/LCY).
	const suggestedOrigins = $derived.by(() => {
		if (homeLat === null || homeLng === null) return [] as Airport[];
		const exclude = [homeAirport, ...additionalOrigins.map((a) => a.iata)].filter(
			(x): x is string => typeof x === 'string'
		);
		return findNearbyAirports(homeLat, homeLng, 120, exclude).slice(0, 5);
	});

	function addOrigin(airport: Airport) {
		if (airport.iata === homeAirport) return;
		if (additionalOrigins.some((a) => a.iata === airport.iata)) return;
		additionalOrigins = [...additionalOrigins, airport];
		addOriginKey++;
	}

	function removeOrigin(iata: string) {
		additionalOrigins = additionalOrigins.filter((a) => a.iata !== iata);
	}

	function toggleDefaultEvent(eventId: string) {
		if (defaultEvents.has(eventId)) {
			defaultEvents.delete(eventId);
		} else {
			defaultEvents.add(eventId);
		}
	}

	function handleSave() {
		preferences.update({
			homeAirport,
			homeLatitude: homeLat,
			homeLongitude: homeLng,
			additionalHomeAirports: additionalOrigins,
			driveableRadius: radius,
			unit,
			defaultEvents: [...defaultEvents],
			allowPartialDefault,
			maxDaysBeforeComp: Math.max(1, Math.min(7, Math.round(maxDaysBeforeComp))),
			skipClosedFlights
		});
		onClose();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) handleSave();
	}

	const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleSave();
			return;
		}

		// Focus trap: cycle Tab within the dialog
		if (e.key === 'Tab' && panelEl) {
			const focusable = [...panelEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
				(el) => !el.hasAttribute('disabled') && el.offsetParent !== null
			);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	let clearConfirmPending = $state(false);
	let clearConfirmTimer: ReturnType<typeof setTimeout> | undefined;

	function handleClearClick() {
		if (clearConfirmPending) {
			clearTimeout(clearConfirmTimer);
			clearConfirmPending = false;
			preferences.reset();
			onClose();
		} else {
			clearConfirmPending = true;
			clearConfirmTimer = setTimeout(() => {
				clearConfirmPending = false;
			}, 3000);
		}
	}

	let panelEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		if (open && panelEl) {
			// Focus the panel on open so keyboard users start inside the dialog
			panelEl.focus();
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
		onmousedown={handleBackdrop}
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

		<!-- Panel -->
		<div
			bind:this={panelEl}
			role="dialog"
			aria-modal="true"
			aria-labelledby="prefs-title"
			tabindex="-1"
			class="modal-enter relative w-full max-w-md overflow-hidden rounded-2xl border border-airline-slate/40 bg-airline-navy shadow-2xl shadow-black/50 focus:outline-none"
		>
			<!-- Header bar -->
			<div
				class="flex items-center justify-between border-b border-airline-slate/30 bg-airline-midnight px-6 py-4"
			>
				<div>
					<p
						id="prefs-title"
						class="font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase"
					>
						PASSENGER SETTINGS
					</p>
					<p class="mt-0.5 text-xs text-slate-500">Configure your home base</p>
				</div>
				<button
					onclick={onClose}
					class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-airline-slate/30 hover:text-white"
				>
					✕
				</button>
			</div>

			<!-- Body -->
			<div class="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
				<!-- Home Airport -->
				<div>
					<p
						id="prefs-airport-label"
						class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase"
					>
						HOME AIRPORT
					</p>
					<AirportAutocomplete
						value={homeAirport}
						onSelect={handleAirportSelect}
						labelledBy="prefs-airport-label"
					/>
				</div>

				<!-- Also Search From (multi-origin) -->
				{#if homeAirport}
					<div>
						<p class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase">
							ALSO SEARCH FROM
						</p>
						<p class="mb-2 text-[10px] text-slate-500">
							Add extra origins so flight search quotes fares from each — great for multi-airport
							metros like NYC, LA, or the Bay Area.
						</p>

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
							<div class="mb-2">
								<p class="mb-1 font-mono text-[9px] tracking-widest text-slate-500 uppercase">
									NEARBY SUGGESTIONS
								</p>
								<div class="flex flex-wrap gap-1.5">
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
							</div>
						{/if}

						{#key addOriginKey}
							<AirportAutocomplete value={null} onSelect={addOrigin} />
						{/key}
					</div>
				{/if}

				<!-- Driveable Radius -->
				<div>
					<label
						for="radius-input"
						class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
					>
						DRIVEABLE RADIUS
					</label>
					<div class="flex items-center gap-3">
						<input
							id="radius-input"
							type="number"
							bind:value={radius}
							min="0"
							max="2000"
							step="50"
							class="w-24 rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
						/>
						<span class="font-mono text-xs text-slate-400">{unit}</span>
						<input
							type="range"
							bind:value={radius}
							min="0"
							max="2000"
							step="50"
							class="radius-slider flex-1"
						/>
					</div>
				</div>

				<!-- Unit Toggle -->
				<div>
					<p class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase">
						DISTANCE UNIT
					</p>
					<div
						class="inline-flex rounded-lg border border-airline-slate/40 bg-airline-midnight p-0.5"
					>
						<button
							type="button"
							aria-pressed={unit === 'miles'}
							onclick={() => {
								if (unit !== 'miles') {
									radius = Math.round(radius / 1.60934);
									unit = 'miles';
								}
							}}
							class="cursor-pointer rounded-md px-4 py-1.5 font-mono text-xs font-semibold tracking-wider transition-all
								{unit === 'miles'
								? 'bg-airline-amber text-airline-midnight shadow-sm'
								: 'text-slate-400 hover:text-white'}"
						>
							MILES
						</button>
						<button
							type="button"
							aria-pressed={unit === 'km'}
							onclick={() => {
								if (unit !== 'km') {
									radius = Math.round(radius * 1.60934);
									unit = 'km';
								}
							}}
							class="cursor-pointer rounded-md px-4 py-1.5 font-mono text-xs font-semibold tracking-wider transition-all
								{unit === 'km'
								? 'bg-airline-amber text-airline-midnight shadow-sm'
								: 'text-slate-400 hover:text-white'}"
						>
							KM
						</button>
					</div>
				</div>
				<!-- Default Event Filters -->
				<div>
					<p class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase">
						DEFAULT EVENT FILTERS
					</p>
					<p class="mb-2 text-[10px] text-slate-500">Pre-select these events each time you visit</p>
					<div class="flex flex-wrap gap-1.5">
						{#each ALL_EVENT_IDS as eventId (eventId)}
							{@const isSelected = defaultEvents.has(eventId)}
							<button
								type="button"
								onclick={() => toggleDefaultEvent(eventId)}
								class="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-all
									{isSelected
									? 'border-airline-amber bg-airline-amber text-white'
									: 'border-airline-slate/40 text-airline-slate-light hover:border-airline-slate-light hover:text-white'}"
							>
								<span class="cubing-icon event-{eventId} text-xs"></span>
								<span class="tracking-wider">{EVENT_NAMES[eventId]}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Max days before comp -->
				<div>
					<label
						for="max-days-input"
						class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
					>
						MAX DAYS EARLY
					</label>
					<p class="mb-2 text-[10px] text-slate-500">
						At 1, we show day-before flights and only widen if the flight would land during the
						comp. At 2+, we search every day in the window and show the cheapest — good for finding
						deals on long trips.
					</p>
					<div class="flex items-center gap-3">
						<input
							id="max-days-input"
							type="number"
							bind:value={maxDaysBeforeComp}
							min="1"
							max="7"
							step="1"
							class="w-20 rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
						/>
						<span class="font-mono text-xs text-slate-400"
							>day{maxDaysBeforeComp === 1 ? '' : 's'}</span
						>
						<input
							type="range"
							bind:value={maxDaysBeforeComp}
							min="1"
							max="7"
							step="1"
							class="radius-slider flex-1"
							aria-label="Maximum days before competition"
						/>
					</div>
					<p class="mt-1.5 text-[9px] text-slate-500 italic">
						{maxDaysBeforeComp === 1
							? 'Default: one day before, auto-widen only if needed to arrive in time.'
							: `Cheapest-within-window mode: searching every day from 1 to ${maxDaysBeforeComp} before the comp.`}
					</p>
				</div>

				<!-- Skip Closed Flights -->
				<div>
					<label class="group flex cursor-pointer items-center gap-2.5">
						<div class="toggle-track relative">
							<input type="checkbox" bind:checked={skipClosedFlights} class="peer sr-only" />
							<div
								class="h-5 w-9 rounded-full bg-airline-slate transition-colors peer-checked:bg-airline-amber"
							></div>
							<div
								class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
							></div>
						</div>
						<div>
							<span class="font-mono text-[10px] tracking-widest text-airline-amber uppercase">
								SKIP CLOSED COMPS
							</span>
							<p class="text-[10px] text-slate-500">
								Don't search flights for competitions you can't register for. Faster results.
							</p>
						</div>
					</label>
				</div>

				<!-- Allow Partial Default -->
				<div>
					<label class="group flex cursor-pointer items-center gap-2.5">
						<div class="toggle-track relative">
							<input type="checkbox" bind:checked={allowPartialDefault} class="peer sr-only" />
							<div
								class="h-5 w-9 rounded-full bg-airline-slate transition-colors peer-checked:bg-airline-amber"
							></div>
							<div
								class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
							></div>
						</div>
						<div>
							<span class="font-mono text-[10px] tracking-widest text-airline-amber uppercase">
								ALLOW PARTIAL ATTENDANCE
							</span>
							<p class="text-[10px] text-slate-500">
								Show flights that arrive after the comp starts
							</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Footer -->
			<div class="border-t border-airline-slate/30 bg-airline-midnight/50 px-6 py-4">
				<button
					onclick={handleSave}
					class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-airline-amber px-6 py-2.5 font-mono text-sm font-bold tracking-wider text-airline-midnight transition-colors hover:bg-airline-amber-light"
				>
					<span>✈</span>
					SAVE PREFERENCES
				</button>
				<div class="mt-3 flex items-center justify-between">
					<p class="text-[9px] text-slate-500">
						Preferences are saved in your browser. Your airport code is sent to search for flights
						but is not stored.
						<a
							href="/privacy"
							class="underline underline-offset-2 transition-colors hover:text-slate-300"
							>Privacy notice</a
						>
					</p>
					<button
						type="button"
						onclick={handleClearClick}
						class="cursor-pointer font-mono text-[9px] whitespace-nowrap underline-offset-2 transition-colors
							{clearConfirmPending
							? 'font-semibold text-red-400 underline'
							: 'text-slate-500 hover:text-red-400 hover:underline'}"
					>
						{clearConfirmPending ? 'ARE YOU SURE?' : 'CLEAR ALL DATA'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.modal-enter {
		animation: modal-in 0.25s ease-out;
	}

	.radius-slider {
		appearance: none;
		height: 4px;
		background: var(--color-airline-slate);
		border-radius: 2px;
		outline: none;
	}
	.radius-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-airline-amber);
		cursor: pointer;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
	}
	.toggle-track {
		display: flex;
		align-items: center;
	}
	.radius-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-airline-amber);
		cursor: pointer;
		border: none;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
	}
</style>
