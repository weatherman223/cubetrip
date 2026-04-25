<script lang="ts">
	import { MAX_DISTANCE_KM } from '$lib/stores/preferences.svelte';
	import type { DistanceUnit } from '$lib/stores/preferences.svelte';

	const KM_PER_MILE = 1.60934;
	const STEP_DISPLAY = 100;

	let {
		value,
		unit,
		homeAirportSet,
		onChange
	}: {
		value: number; // km
		unit: DistanceUnit;
		homeAirportSet: boolean;
		onChange: (km: number) => void;
	} = $props();

	const maxDisplay = $derived(
		unit === 'km' ? MAX_DISTANCE_KM : Math.round(MAX_DISTANCE_KM / KM_PER_MILE)
	);

	// Display value in user's unit. Snap to step so the number-input/slider stay in sync.
	const display = $derived.by(() => {
		const raw = unit === 'km' ? value : value / KM_PER_MILE;
		return Math.round(raw / STEP_DISPLAY) * STEP_DISPLAY;
	});

	const isNoLimit = $derived(value >= MAX_DISTANCE_KM);

	function handleDisplay(next: number) {
		const clamped = Math.max(0, Math.min(maxDisplay, Math.round(next)));
		// Snap the max-display value to the exact MAX_DISTANCE_KM sentinel so
		// "NO LIMIT" is reliably reachable from either unit.
		if (clamped >= maxDisplay) {
			onChange(MAX_DISTANCE_KM);
			return;
		}
		const km = unit === 'km' ? clamped : clamped * KM_PER_MILE;
		onChange(km);
	}
</script>

<div>
	<div class="mb-1.5 flex items-baseline justify-between gap-2">
		<label
			for="distance-limit-input"
			class="font-mono text-[10px] tracking-widest text-airline-amber uppercase"
		>
			MAX TRAVEL DISTANCE
		</label>
		<span class="font-mono text-[10px] text-slate-400">
			{#if isNoLimit}NO LIMIT{:else}{display.toLocaleString()} {unit}{/if}
		</span>
	</div>
	{#if !homeAirportSet}
		<p class="text-[10px] text-slate-500 italic">
			Set a home airport to enable distance filtering.
		</p>
	{:else}
		<div class="flex items-center gap-3">
			<input
				id="distance-limit-input"
				type="number"
				value={display}
				oninput={(e) => handleDisplay(+e.currentTarget.value)}
				min="0"
				max={maxDisplay}
				step={STEP_DISPLAY}
				class="w-24 rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
			/>
			<span class="font-mono text-xs text-slate-400">{unit}</span>
			<input
				type="range"
				value={display}
				oninput={(e) => handleDisplay(+e.currentTarget.value)}
				min="0"
				max={maxDisplay}
				step={STEP_DISPLAY}
				class="distance-slider flex-1"
				aria-label="Maximum travel distance"
			/>
		</div>
	{/if}
</div>

<style>
	.distance-slider {
		appearance: none;
		height: 4px;
		background: var(--color-airline-slate);
		border-radius: 2px;
		outline: none;
	}
	.distance-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-airline-amber);
		cursor: pointer;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
	}
	.distance-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-airline-amber);
		cursor: pointer;
		border: none;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
	}
</style>
