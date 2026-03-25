<script lang="ts">
	interface Airport {
		iata: string;
		name: string;
		latitude: number;
		longitude: number;
		city: string;
		country: string;
	}

	let {
		value,
		onSelect
	}: {
		value: string | null;
		onSelect: (airport: Airport) => void;
	} = $props();

	let query = $state('');
	let isOpen = $state(false);
	let focusedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let inputEl: HTMLInputElement | undefined;

	$effect(() => {
		query = value ?? '';
	});

	let filteredResults: Airport[] = $state([]);

	async function runFilter(q: string) {
		if (q.length < 2) {
			filteredResults = [];
			return;
		}
		try {
			const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				const data = await res.json();
				filteredResults = data.airports;
			}
		} catch {
			// Silently fail — user can keep typing
		}
	}

	function handleInput() {
		selected = false;
		isOpen = true;
		focusedIndex = -1;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => runFilter(query), 150);
	}

	let selected = $state(false);

	function selectAirport(airport: Airport) {
		query = airport.iata;
		selected = true;
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
				}
				break;
			case 'Escape':
				isOpen = false;
				focusedIndex = -1;
				break;
		}
	}

	function handleBlur() {
		setTimeout(() => {
			isOpen = false;
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
			{#each filteredResults as airport, i}
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
	{/if}
</div>
