<script lang="ts">
	const SORT_OPTIONS = [
		{ value: 'cost', label: 'COST' },
		{ value: 'distance', label: 'DISTANCE' },
		{ value: 'date', label: 'DATE' },
		{ value: 'name', label: 'NAME' }
	] as const;

	let {
		currentSort,
		onSort,
		flightsLoading = false
	}: {
		currentSort: string;
		onSort: (sort: string) => void;
		flightsLoading?: boolean;
	} = $props();
</script>

<div class="flex items-center gap-1.5">
	<span class="mr-1 font-mono text-[10px] tracking-widest text-airline-slate-light uppercase">
		SORT
	</span>
	{#each SORT_OPTIONS as opt}
		<button
			aria-pressed={currentSort === opt.value}
			onclick={() => onSort(opt.value)}
			class="cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wider transition-all
				{currentSort === opt.value
				? 'border-airline-amber bg-airline-amber text-airline-midnight'
				: 'border-airline-slate/40 text-airline-slate-light hover:border-airline-slate-light hover:text-white'}"
		>
			{opt.label}
		</button>
	{/each}
	{#if currentSort === 'cost' && flightsLoading}
		<span class="ml-1 font-mono text-[9px] text-airline-slate-light animate-pulse">(loading prices)</span>
	{/if}
</div>
