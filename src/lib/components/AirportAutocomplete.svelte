<script lang="ts">
	import type { Airport } from '$lib/types';

	let {
		value,
		onSelect,
		labelledBy
	}: {
		value: string | null;
		onSelect: (airport: Airport) => void;
		labelledBy?: string;
	} = $props();

	let query = $derived(value ?? '');
	let isOpen = $state(false);
	let focusedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let inputEl: HTMLInputElement | undefined;

	let filteredResults: Airport[] = $state([]);
	let searchError = $state(false);

	async function runFilter(q: string) {
		if (q.trim().length < 2) {
			filteredResults = [];
			searchError = false;
			return;
		}
		try {
			const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				const data = await res.json();
				filteredResults = data.airports;
				searchError = false;
			} else {
				searchError = true;
			}
		} catch {
			searchError = true;
		}
	}

	function handleInput() {
		isOpen = true;
		focusedIndex = -1;
		searchError = false;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => runFilter(query), 150);
	}

	function selectAirport(airport: Airport) {
		query = airport.iata;
		isOpen = false;
		focusedIndex = -1;
		onSelect(airport);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen || filteredResults.length === 0) {
			if (e.key === 'ArrowDown' && query.length >= 2) {
				isOpen = true;
				runFilter(query);
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				focusedIndex = Math.min(focusedIndex + 1, filteredResults.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusedIndex = Math.max(focusedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (focusedIndex >= 0) {
					selectAirport(filteredResults[focusedIndex]);
				} else {
					// No option highlighted: commit the exact IATA match if the user
					// typed one (e.g. "JFK"), otherwise the top suggestion — Enter
					// should never silently discard visible results.
					const typed = query.trim().toUpperCase();
					const exact = filteredResults.find((a) => a.iata === typed);
					selectAirport(exact ?? filteredResults[0]);
				}
				break;
			case 'Escape':
				// Contain Escape to the dropdown — without this it bubbles to the
				// PreferencesModal wrapper and closes the whole dialog in one press.
				e.preventDefault();
				e.stopPropagation();
				isOpen = false;
				focusedIndex = -1;
				break;
		}
	}

	function handleBlur() {
		// Delay lets an option's onmousedown selection land first. Afterwards,
		// revert any uncommitted free text to the confirmed value so the input
		// never displays a code that was never actually saved.
		setTimeout(() => {
			isOpen = false;
			query = value ?? '';
		}, 200);
	}
</script>

<div class="relative">
	<input
		bind:this={inputEl}
		bind:value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={() => {
			if (query.length >= 2) {
				isOpen = true;
				runFilter(query);
			}
		}}
		onblur={handleBlur}
		type="text"
		role="combobox"
		aria-expanded={isOpen && filteredResults.length > 0}
		aria-haspopup="listbox"
		aria-autocomplete="list"
		aria-controls="airport-listbox"
		aria-activedescendant={focusedIndex >= 0 ? `airport-opt-${focusedIndex}` : undefined}
		aria-labelledby={labelledBy}
		placeholder="Search by code, city, or name…"
		autocomplete="off"
		class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors placeholder:text-airline-slate-light/50 focus:border-airline-amber focus:outline-none"
	/>

	{#if isOpen && filteredResults.length > 0}
		<ul
			id="airport-listbox"
			role="listbox"
			class="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border border-airline-slate/60 bg-airline-navy shadow-xl shadow-black/40"
		>
			{#each filteredResults as airport, i (airport.iata)}
				<li role="option" id="airport-opt-{i}" aria-selected={i === focusedIndex}>
					<button
						type="button"
						tabindex="-1"
						onmousedown={() => selectAirport(airport)}
						class="flex w-full cursor-pointer items-baseline gap-2 px-3 py-2 text-left transition-colors
							{i === focusedIndex
							? 'bg-airline-amber/15 text-white'
							: 'text-slate-300 hover:bg-airline-slate/30'}"
					>
						<span class="font-mono text-sm font-bold text-airline-amber">{airport.iata}</span>
						<span class="text-xs text-slate-400">—</span>
						<span class="truncate text-sm">
							{airport.city}{airport.city && airport.country ? ', ' : ''}{airport.country}
						</span>
						<span class="ml-auto shrink-0 text-[10px] text-slate-500">{airport.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if isOpen && searchError && filteredResults.length === 0}
		<div
			class="absolute top-full z-50 mt-1 w-full rounded-lg border border-airline-cancelled/30 bg-airline-navy px-3 py-2 text-center font-mono text-[10px] text-airline-cancelled/80 shadow-xl"
		>
			Search failed — try again
		</div>
	{/if}
</div>
