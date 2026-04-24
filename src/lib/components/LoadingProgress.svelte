<script lang="ts">
	let {
		label,
		current,
		total,
		subtitle = null
	}: {
		label: string;
		current: number;
		total: number;
		subtitle?: string | null;
	} = $props();

	const pct = $derived(total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0);
	const done = $derived(total === 0 || current >= total);
</script>

{#if !done}
	<div
		class="flex flex-col gap-0.5"
		role="progressbar"
		aria-valuenow={current}
		aria-valuemin={0}
		aria-valuemax={total}
		aria-label={label}
	>
		<div class="flex items-baseline justify-between gap-3">
			<span class="font-mono text-[10px] tracking-widest text-airline-slate-light uppercase">
				{label}
			</span>
			<span class="font-mono text-[10px] text-airline-amber tabular-nums">
				{current}/{total}
			</span>
		</div>
		<div class="h-[3px] w-full overflow-hidden rounded-full bg-airline-slate/40">
			<div
				class="h-full rounded-full bg-airline-amber transition-[width] duration-300 ease-out"
				style:width="{pct}%"
			></div>
		</div>
		{#if subtitle}
			<span class="font-mono text-[9px] text-slate-500 italic">{subtitle}</span>
		{/if}
	</div>
{/if}
