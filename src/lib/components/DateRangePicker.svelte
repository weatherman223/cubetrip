<script lang="ts">
	let props: {
		startDate: string;
		endDate: string;
		onSearch: (start: string, end: string) => void;
		loading: boolean;
	} = $props();

	let start = $state('');
	let end = $state('');

	$effect(() => {
		start = props.startDate;
		end = props.endDate;
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (start && end && end >= start) {
			props.onSearch(start, end);
		}
	}

	function toYMD(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function getNextWeekend(weeksAhead: number): { start: string; end: string } {
		const now = new Date();
		const day = now.getDay(); // 0=Sun
		const daysToSat = ((6 - day + 7) % 7 || 7) + (weeksAhead - 1) * 7;
		const sat = new Date(now);
		sat.setDate(now.getDate() + daysToSat);
		const sun = new Date(sat);
		sun.setDate(sat.getDate() + 1);
		return { start: toYMD(sat), end: toYMD(sun) };
	}

	function selectWeekend(weeksAhead: number) {
		const wk = getNextWeekend(weeksAhead);
		start = wk.start;
		end = wk.end;
		props.onSearch(start, end);
	}
</script>

<div class="space-y-2">
	<!-- Quick select -->
	<div class="flex gap-2">
		<button
			type="button"
			onclick={() => selectWeekend(1)}
			disabled={props.loading}
			class="cursor-pointer rounded-full border border-airline-slate/40 px-3 py-1 font-mono text-[10px] tracking-wider text-airline-slate-light transition-colors hover:border-airline-amber/50 hover:text-airline-amber disabled:opacity-50"
		>
			THIS WEEKEND
		</button>
		<button
			type="button"
			onclick={() => selectWeekend(2)}
			disabled={props.loading}
			class="cursor-pointer rounded-full border border-airline-slate/40 px-3 py-1 font-mono text-[10px] tracking-wider text-airline-slate-light transition-colors hover:border-airline-amber/50 hover:text-airline-amber disabled:opacity-50"
		>
			NEXT WEEKEND
		</button>
	</div>

	<!-- Date range form -->
	<form
		onsubmit={handleSubmit}
		class="flex flex-col items-end gap-4 rounded-xl border border-airline-slate/40 bg-airline-navy/80 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center"
	>
		<div class="flex w-full flex-1 flex-col gap-4 sm:flex-row">
			<div class="flex-1">
				<label
					for="start-date"
					class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
				>
					DEPARTURE FROM
				</label>
				<input
					id="start-date"
					type="date"
					bind:value={start}
					required
					class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
				/>
			</div>
			<div class="flex-1">
				<label
					for="end-date"
					class="mb-1.5 block font-mono text-[10px] tracking-widest text-airline-amber uppercase"
				>
					RETURN BY
				</label>
				<input
					id="end-date"
					type="date"
					bind:value={end}
					required
					min={start}
					class="w-full rounded-lg border border-airline-slate bg-airline-midnight px-3 py-2 font-mono text-sm text-white transition-colors focus:border-airline-amber focus:outline-none"
				/>
			</div>
		</div>

		<button
			type="submit"
			disabled={props.loading || !start || !end || end < start}
			class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-airline-amber px-6 py-2.5 font-mono text-sm font-bold tracking-wider text-airline-midnight transition-colors hover:bg-airline-amber-light disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
		>
			{#if props.loading}
				<span class="inline-block animate-spin">✈</span>
				SEARCHING…
			{:else}
				<span>✈</span>
				SEARCH FLIGHTS
			{/if}
		</button>
	</form>
</div>
