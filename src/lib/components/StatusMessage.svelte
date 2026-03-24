<script lang="ts">
	import SkeletonCard from './SkeletonCard.svelte';

	let {
		variant,
		message,
		onRetry
	}: {
		variant: 'loading' | 'error' | 'empty';
		message?: string;
		onRetry?: () => void;
	} = $props();
</script>

{#if variant === 'loading'}
	<div class="flex flex-col gap-4">
		{#each { length: 3 } as _, i}
			<SkeletonCard delay={i * 120} />
		{/each}
		<p class="mt-2 text-center font-mono text-xs tracking-wider text-airline-slate-light uppercase">
			{message ?? 'Searching departures…'}
		</p>
	</div>
{:else if variant === 'error'}
	<div
		class="error-card mx-auto max-w-md rounded-xl border border-airline-cancelled/20 bg-airline-navy/60 p-8 text-center shadow-lg backdrop-blur"
	>
		<div class="mb-3 font-mono text-4xl leading-none">⚠</div>
		<p class="mb-1 font-mono text-xs tracking-widest text-airline-cancelled/80 uppercase">
			FLIGHT DISRUPTION
		</p>
		<p class="mb-6 text-sm text-slate-300">
			{message ?? 'Something went wrong while fetching departures.'}
		</p>
		{#if onRetry}
			<button
				onclick={onRetry}
				class="group cursor-pointer rounded-lg bg-airline-amber px-6 py-2.5 font-mono text-sm font-bold tracking-wider text-airline-midnight transition-all hover:bg-airline-amber-light hover:shadow-md hover:shadow-airline-amber/20"
			>
				<span class="mr-1.5 inline-block transition-transform group-hover:-translate-y-0.5">✈</span>
				RETRY SEARCH
			</button>
		{/if}
	</div>
{:else}
	<div
		class="mx-auto max-w-md rounded-xl border border-airline-slate/20 bg-airline-navy/40 p-8 text-center backdrop-blur"
	>
		<div class="mb-3 font-mono text-4xl leading-none">🛬</div>
		<p class="mb-1 font-mono text-xs tracking-widest text-airline-slate-light uppercase">
			NO DEPARTURES SCHEDULED
		</p>
		<p class="text-sm text-slate-400">
			{message ?? 'No competitions found for this date range. Try expanding your search window.'}
		</p>
	</div>
{/if}
