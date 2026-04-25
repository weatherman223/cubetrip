<script lang="ts">
	import type { RouteEvent } from '$lib/utils/flight-search';

	let { events }: { events: Array<{ id: number; event: RouteEvent }> } = $props();

	const MAX_VISIBLE = 6;
	// Newest at the top — events are appended in chronological order, so reverse
	// the tail. Slice cap keeps the DOM small even if the buffer behind us is large.
	const visible = $derived([...events].slice(-MAX_VISIBLE).reverse());
</script>

{#if events.length > 0}
	<div
		class="rounded-md border border-airline-slate/20 bg-airline-midnight/40 px-2 py-1.5"
		aria-live="polite"
		aria-label="Flight search activity"
	>
		<div class="space-y-0.5">
			{#each visible as { id, event } (id)}
				<div class="feed-row flex items-center gap-2 font-mono text-[10px] leading-tight">
					<span class="w-3 text-center" aria-hidden="true">
						{#if event.kind === 'start'}
							<span class="pulse-dot text-airline-amber">⟳</span>
						{:else if event.kind === 'hit'}
							<span class="text-airline-amber">✓</span>
						{:else if event.kind === 'empty'}
							<span class="text-slate-600">·</span>
						{:else}
							<span class="text-red-400">✕</span>
						{/if}
					</span>
					<span class="max-w-[14rem] flex-shrink-0 truncate text-airline-slate-light"
						>{event.compName}</span
					>
					<span class="text-slate-600">·</span>
					<span class="font-bold text-white tabular-nums"
						>{event.origin}<span class="px-0.5 text-slate-500">→</span>{event.destination}</span
					>
					<span class="ml-auto text-[9px] tabular-nums">
						{#if event.kind === 'hit'}
							<span class="text-airline-amber">${event.price}</span>
						{:else if event.kind === 'empty'}
							<span class="text-slate-600">empty</span>
						{:else if event.kind === 'error'}
							<span class="text-red-400">error</span>
						{:else}
							<span class="text-slate-500">…</span>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.feed-row {
		animation: feed-in 220ms ease-out;
	}

	@keyframes feed-in {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	.pulse-dot {
		display: inline-block;
		animation: pulse 1s ease-in-out infinite;
	}
</style>
