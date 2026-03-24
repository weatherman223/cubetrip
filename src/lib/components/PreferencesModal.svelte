<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';
	import type { DistanceUnit } from '$lib/stores/preferences.svelte';
	import AirportAutocomplete from './AirportAutocomplete.svelte';
	import { ALL_EVENT_IDS, EVENT_NAMES } from '$lib/utils/events';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	let homeAirport = $state<string | null>(null);
	let homeLat = $state<number | null>(null);
	let homeLng = $state<number | null>(null);
	let radius = $state(300);
	let unit = $state<DistanceUnit>('miles');
	let defaultEvents = $state<Set<string>>(new Set());
	let allowPartialDefault = $state(false);

	$effect(() => {
		if (open) {
			const p = preferences.current;
			homeAirport = p.homeAirport;
			homeLat = p.homeLatitude;
			homeLng = p.homeLongitude;
			radius = p.driveableRadius;
			unit = p.unit;
			defaultEvents = new Set(p.defaultEvents);
			allowPartialDefault = p.allowPartialDefault;
		}
	});

	function handleAirportSelect(airport: { iata: string; latitude: number; longitude: number }) {
		homeAirport = airport.iata;
		homeLat = airport.latitude;
		homeLng = airport.longitude;
	}

	function toggleDefaultEvent(eventId: string) {
		const next = new Set(defaultEvents);
		if (next.has(eventId)) {
			next.delete(eventId);
		} else {
			next.add(eventId);
		}
		defaultEvents = next;
	}

	function handleSave() {
		preferences.update({
			homeAirport,
			homeLatitude: homeLat,
			homeLongitude: homeLng,
			driveableRadius: radius,
			unit,
			defaultEvents: [...defaultEvents],
			allowPartialDefault
		});
		onClose();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
		onmousedown={handleBackdrop}
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

		<!-- Panel -->
		<div
			class="modal-enter relative w-full max-w-md overflow-hidden rounded-2xl border border-airline-slate/40 bg-airline-navy shadow-2xl shadow-black/50"
		>
			<!-- Header bar -->
			<div
				class="flex items-center justify-between border-b border-airline-slate/30 bg-airline-midnight px-6 py-4"
			>
				<div>
					<p class="font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
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
					<p class="mb-1.5 font-mono text-[10px] tracking-widest text-airline-amber uppercase">
						HOME AIRPORT
					</p>
					<AirportAutocomplete value={homeAirport} onSelect={handleAirportSelect} />
				</div>

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
							onclick={() => (unit = 'miles')}
							class="cursor-pointer rounded-md px-4 py-1.5 font-mono text-xs font-semibold tracking-wider transition-all
								{unit === 'miles'
								? 'bg-airline-amber text-airline-midnight shadow-sm'
								: 'text-slate-400 hover:text-white'}"
						>
							MILES
						</button>
						<button
							type="button"
							onclick={() => (unit = 'km')}
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
						{#each ALL_EVENT_IDS as eventId}
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
