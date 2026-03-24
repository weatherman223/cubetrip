<script lang="ts">
	import { ALL_EVENT_IDS, EVENT_NAMES } from '$lib/utils/events';

	let {
		selectedEvents,
		onToggle
	}: {
		selectedEvents: Set<string>;
		onToggle: (eventId: string) => void;
	} = $props();

	const hasSelection = $derived(selectedEvents.size > 0);
</script>

<div
	class="flex items-center gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
>
	<span class="mr-1 font-mono text-[10px] tracking-widest text-airline-slate-light uppercase">
		EVENTS
	</span>

	{#each ALL_EVENT_IDS as eventId}
		{@const isSelected = selectedEvents.has(eventId)}
		<button
			onclick={() => onToggle(eventId)}
			class="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-all
				{isSelected
				? 'border-airline-amber bg-airline-amber text-white shadow-sm shadow-airline-amber/20'
				: 'border-airline-slate/40 text-airline-slate-light hover:border-airline-slate-light hover:text-white'}"
			title={EVENT_NAMES[eventId]}
		>
			<span class="cubing-icon event-{eventId} text-xs"></span>
			<span class="tracking-wider">{EVENT_NAMES[eventId]}</span>
		</button>
	{/each}

	{#if hasSelection}
		<button
			onclick={() => {
				for (const id of [...selectedEvents]) onToggle(id);
			}}
			class="ml-1 cursor-pointer rounded-full border border-airline-slate/40 px-2 py-0.5 font-mono text-[9px] tracking-wider text-airline-slate-light transition-colors hover:border-airline-cancelled/50 hover:text-airline-cancelled"
		>
			CLEAR
		</button>
	{/if}
</div>
