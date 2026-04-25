<script lang="ts">
	import {
		CONTINENTS,
		COUNTRIES,
		COUNTRIES_BY_CONTINENT,
		type Continent
	} from '$lib/utils/countries';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		selected,
		onChange
	}: {
		selected: string[];
		onChange: (next: string[]) => void;
	} = $props();

	let query = $state('');

	const selectedSet = $derived(new SvelteSet(selected));

	const filteredCountries = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return COUNTRIES;
		return COUNTRIES.filter(
			(c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q)
		);
	});

	function continentState(cont: Continent): 'all' | 'some' | 'none' {
		const list = COUNTRIES_BY_CONTINENT.get(cont) ?? [];
		let count = 0;
		for (const c of list) if (selectedSet.has(c.iso2)) count++;
		if (count === 0) return 'none';
		if (count === list.length) return 'all';
		return 'some';
	}

	function toggleContinent(cont: Continent) {
		const list = COUNTRIES_BY_CONTINENT.get(cont) ?? [];
		const state = continentState(cont);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient set inside handler, never reactive
		const next = new Set(selected);
		if (state === 'all') {
			for (const c of list) next.delete(c.iso2);
		} else {
			for (const c of list) next.add(c.iso2);
		}
		onChange([...next]);
	}

	function toggleCountry(iso2: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient set inside handler, never reactive
		const next = new Set(selected);
		if (next.has(iso2)) next.delete(iso2);
		else next.add(iso2);
		onChange([...next]);
	}

	function clearAll() {
		onChange([]);
		query = '';
	}
</script>

<div>
	<div class="mb-1.5 flex items-baseline justify-between gap-2">
		<p class="font-mono text-[10px] tracking-widest text-airline-amber uppercase">COUNTRIES</p>
		{#if selected.length > 0}
			<button
				type="button"
				onclick={clearAll}
				class="cursor-pointer font-mono text-[9px] tracking-widest text-slate-500 uppercase transition-colors hover:text-airline-amber"
			>
				CLEAR
			</button>
		{:else}
			<span class="font-mono text-[9px] text-slate-500 italic">all shown</span>
		{/if}
	</div>

	<div class="mb-2 flex flex-wrap gap-1.5">
		{#each CONTINENTS as cont (cont)}
			{@const state = continentState(cont)}
			<button
				type="button"
				onclick={() => toggleContinent(cont)}
				aria-pressed={state === 'all'}
				class="cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wider transition-all
					{state === 'all'
					? 'border-airline-amber bg-airline-amber text-airline-midnight'
					: state === 'some'
						? 'border-airline-amber/70 bg-airline-amber/10 text-airline-amber'
						: 'border-airline-slate/40 text-airline-slate-light hover:border-airline-slate-light hover:text-white'}"
			>
				{cont}
			</button>
		{/each}
	</div>

	<input
		type="text"
		bind:value={query}
		placeholder="Search countries…"
		class="mb-2 w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-airline-amber focus:outline-none"
	/>

	<div
		class="max-h-48 overflow-y-auto rounded-lg border border-airline-slate/30 bg-airline-midnight/40"
	>
		{#if filteredCountries.length === 0}
			<p class="px-3 py-4 text-center font-mono text-[10px] text-slate-500">No matches</p>
		{:else}
			{#each filteredCountries as c (c.iso2)}
				{@const isSel = selectedSet.has(c.iso2)}
				<label
					class="flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors hover:bg-airline-slate/20"
				>
					<input
						type="checkbox"
						checked={isSel}
						onchange={() => toggleCountry(c.iso2)}
						class="h-3.5 w-3.5 cursor-pointer accent-airline-amber"
					/>
					<span class="font-mono text-[10px] font-bold text-airline-amber">{c.iso2}</span>
					<span class="flex-1 text-xs text-white">{c.name}</span>
					<span class="font-mono text-[9px] tracking-wider text-slate-500 uppercase"
						>{c.continent}</span
					>
				</label>
			{/each}
		{/if}
	</div>
</div>
