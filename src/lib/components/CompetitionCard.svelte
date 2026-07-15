<script lang="ts">
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { FlightResult } from '$lib/server/flights/types';
	import { getStatusTailwind } from '$lib/utils/status-display';
	import EventIcon from './EventIcon.svelte';

	let {
		competition,
		distance = null,
		isDriveable = false,
		unit = 'miles',
		cheapestFlight = null,
		flightFetchedAt = null,
		flightDaysBefore = null,
		cheaperAltFlight = null,
		cheaperFromAltFlight = null,
		flightFallbackUrl = null,
		flightLoading = false,
		flightDayProgress = null,
		hasConflict = false,
		nearestAirportIata = null,
		dataFetchedAt = null,
		onRefresh = null,
		refreshStatus = null
	}: {
		competition: EnrichedCompetition;
		distance?: number | null;
		isDriveable?: boolean;
		unit?: string;
		cheapestFlight?: FlightResult | null;
		flightFetchedAt?: string | null;
		flightDaysBefore?: number | null;
		cheaperAltFlight?: FlightResult | null;
		cheaperFromAltFlight?: FlightResult | null;
		flightFallbackUrl?: string | null;
		flightLoading?: boolean;
		flightDayProgress?: { daysCompleted: number; totalDays: number } | null;
		hasConflict?: boolean;
		nearestAirportIata?: string | null;
		dataFetchedAt?: string | null;
		onRefresh?: ((compId: string) => void) | null;
		refreshStatus?: 'wcif' | 'flights' | 'done' | 'partial' | 'error' | null;
	} = $props();

	function timeAgo(isoDate: string): string {
		const diffMs = Date.now() - new Date(isoDate).getTime();
		const mins = Math.floor(diffMs / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ago`;
	}

	// Convert ISO 3166-1 alpha-2 to regional indicator emoji (0x1F1E6 = Regional Indicator 'A', 65 = ASCII 'A')
	function countryFlag(iso2: string): string {
		return [...iso2.toUpperCase()]
			.map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
			.join('');
	}

	const isCancelled = $derived(competition.cancelled_at !== null);

	/** Strip markdown links: "[text](url)" → "text" */
	function stripLinks(str: string): string {
		return str.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	}

	const statusConfig = $derived(
		getStatusTailwind(competition.wcif?.registrationStatus, isCancelled)
	);

	const competitorLimit = $derived(
		competition.wcif?.competitorLimit ?? competition.competitor_limit
	);

	const distanceLabel = $derived(
		distance !== null
			? `${Math.round(distance).toLocaleString()} ${unit === 'km' ? 'km' : 'mi'}`
			: null
	);
</script>

<article
	class="group relative overflow-hidden rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl {isDriveable
		? 'ring-2 ring-airline-open/40'
		: ''}"
>
	{#if isDriveable}
		<div class="absolute top-0 left-0 z-10 h-full w-1 bg-airline-open"></div>
	{/if}

	{#if isCancelled}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<span
				class="-rotate-12 rounded border-4 border-airline-cancelled px-6 py-2 font-mono text-3xl font-bold tracking-widest text-airline-cancelled opacity-60"
			>
				CANCELLED
			</span>
		</div>
	{/if}

	<div class="flex flex-col md:flex-row" class:opacity-40={isCancelled}>
		<!-- Main section -->
		<div class="flex-1 bg-airline-paper p-5">
			<!-- FLIGHT name -->
			<div class="mb-4 flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<p class="mb-1 font-mono text-[10px] tracking-widest text-slate-400 uppercase">FLIGHT</p>
					<h3 class="truncate text-lg leading-tight font-bold text-slate-800">
						{competition.name}
					</h3>
				</div>
				<!-- Status + refresh -->
				<div class="mt-1 flex items-center gap-2">
					<span class="status-dot inline-block h-2 w-2 rounded-full {statusConfig.dot}"></span>
					<span class="font-mono text-[9px] tracking-wider text-slate-400"
						>{statusConfig.label}</span
					>
					{#if onRefresh}
						{#if refreshStatus === 'wcif'}
							<span class="font-mono text-[9px] text-airline-amber">
								<span class="inline-block animate-spin">↻</span> UPDATING REG
							</span>
						{:else if refreshStatus === 'flights'}
							<span class="font-mono text-[9px] text-airline-amber">
								<span class="inline-block animate-spin">↻</span> CHECKING FARES
							</span>
						{:else if refreshStatus === 'done'}
							<span class="refresh-done font-mono text-[9px] text-airline-open">✓ UPDATED</span>
						{:else if refreshStatus === 'partial'}
							<span class="refresh-done font-mono text-[9px] text-airline-amber"
								>⚠ PARTIALLY UPDATED</span
							>
						{:else if refreshStatus === 'error'}
							<span class="refresh-done font-mono text-[9px] text-airline-cancelled"
								>✗ UPDATE FAILED</span
							>
						{:else}
							<button
								onclick={() => onRefresh?.(competition.id)}
								class="cursor-pointer font-mono text-[9px] text-slate-400 transition-colors hover:text-airline-amber"
								aria-label="Refresh {competition.name}"
							>
								↻
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Location row -->
			<div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
				<div>
					<p class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">FROM</p>
					<p class="text-sm font-semibold text-slate-700">
						{countryFlag(competition.country_iso2)}
						{competition.city}
					</p>
				</div>
				<div>
					<p class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">VENUE</p>
					<p class="truncate text-sm text-slate-600">{stripLinks(competition.venue)}</p>
				</div>
				<div>
					<p class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">GATE</p>
					<p class="font-mono text-sm font-semibold text-slate-700">
						{#if competition.wcif}
							{competition.wcif.competitorCount}/{competitorLimit} registered
						{:else}
							{competitorLimit}
						{/if}
					</p>
					{#if dataFetchedAt}
						<p class="text-[8px] text-slate-400">Updated {timeAgo(dataFetchedAt)}</p>
					{/if}
				</div>
				<div>
					<p class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">DISTANCE</p>
					<p
						class="font-mono text-sm font-semibold {isDriveable
							? 'text-airline-open'
							: 'text-slate-700'}"
					>
						{#if distanceLabel}
							{#if isDriveable}🚗 {distanceLabel}
								<span class="text-[9px] font-normal text-slate-500"
									>~{Math.max(1, Math.round((distance ?? 0) / (unit === 'km' ? 80 : 50)))}h drive</span
								>
							{:else}✈ {distanceLabel}{/if}
						{:else}
							<span class="text-slate-400">—</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Events row -->
			<div>
				<p class="mb-1.5 font-mono text-[10px] tracking-widest text-slate-400 uppercase">EVENTS</p>
				<div class="flex flex-wrap gap-1.5 text-lg text-slate-600">
					{#each competition.event_ids as eventId (eventId)}
						<EventIcon {eventId} />
					{/each}
				</div>
			</div>
		</div>

		<!-- Tear line -->
		<div class="relative hidden w-0 md:block">
			<div class="tear-line absolute inset-0 w-px"></div>
			<div class="tear-notch-top"></div>
			<div class="tear-notch-bottom"></div>
		</div>
		<div class="tear-line-horizontal relative h-px md:hidden"></div>

		<!-- Right stub -->
		<div
			class="flex w-full flex-row items-center justify-between gap-3 bg-airline-paper-warm p-5 md:w-48 md:flex-col md:items-center md:justify-center"
		>
			<div class="text-center">
				<p class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">DATE</p>
				<p class="font-mono text-base leading-tight font-bold text-slate-800">
					{competition.date_range}
				</p>
			</div>

			<div class="flex flex-col items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-mono text-[10px] font-semibold tracking-wider {statusConfig.text} {statusConfig.color}"
				>
					{statusConfig.label}
				</span>

				{#if cheapestFlight && !isDriveable}
					<div class="text-center">
						{#if hasConflict}
							<span
								class="mb-1 inline-block rounded-full bg-airline-amber-dark px-2 py-0.5 font-mono text-[8px] font-semibold tracking-wider text-white"
							>
								⚠ ARRIVES LATE
							</span>
						{:else if flightDaysBefore && flightDaysBefore > 1}
							<span
								class="mb-1 inline-block rounded-full bg-airline-sky/80 px-2 py-0.5 font-mono text-[8px] font-semibold tracking-wider text-white"
								title="Outbound departs {flightDaysBefore} days before the competition so you arrive in time"
							>
								LEAVES {flightDaysBefore} DAYS BEFORE
							</span>
						{/if}
						<p class="font-mono text-lg font-bold text-airline-amber">
							${cheapestFlight.price}
						</p>
						<p class="font-mono text-[9px] font-semibold text-slate-500">
							{cheapestFlight.origin} → {cheapestFlight.destination}
						</p>
						{#if nearestAirportIata}
							<p
								class="font-mono text-[8px] text-airline-amber-dark/70"
								title="Nearest airport {nearestAirportIata} had no flights"
							>
								↗ REROUTED FROM {nearestAirportIata}
							</p>
						{/if}
						<p class="text-[9px] text-slate-500">
							{cheapestFlight.airline} · {cheapestFlight.stops === 0
								? 'nonstop'
								: `${cheapestFlight.stops} stop`}
						</p>
						{#if flightFetchedAt}
							<p class="text-[8px] text-slate-400">
								Prices as of {timeAgo(flightFetchedAt)}
							</p>
						{/if}
						{#if cheaperFromAltFlight}
							<div
								class="mt-1.5 rounded border border-airline-sky/30 bg-airline-sky/5 px-2 py-1"
								title="Same destination, cheaper if you depart from {cheaperFromAltFlight.origin}"
							>
								<p class="font-mono text-[9px] font-bold text-airline-sky">
									${cheaperFromAltFlight.price} via {cheaperFromAltFlight.origin} → {cheaperFromAltFlight.destination}
								</p>
								<p class="text-[8px] text-slate-400">
									Cheaper from {cheaperFromAltFlight.origin}
								</p>
							</div>
						{/if}
						{#if cheaperAltFlight}
							<div
								class="mt-1.5 rounded border border-airline-open/20 bg-airline-open/5 px-2 py-1"
								title="Cheaper if you fly into {cheaperAltFlight.destination} instead"
							>
								<p class="font-mono text-[9px] font-bold text-airline-open">
									${cheaperAltFlight.price} via {cheaperAltFlight.origin} → {cheaperAltFlight.destination}
								</p>
								<p class="text-[8px] text-slate-400">Cheaper but farther</p>
							</div>
						{/if}
						{#if flightFallbackUrl}
							<a
								href={flightFallbackUrl}
								target="_blank"
								rel="noopener noreferrer external"
								class="mt-1 inline-block font-mono text-[8px] tracking-wider text-airline-sky/60 underline-offset-2 transition-colors hover:text-airline-sky hover:underline"
							>
								VIEW ON GOOGLE FLIGHTS
							</a>
						{/if}
					</div>
				{:else if flightLoading && !isDriveable}
					<div class="text-center">
						<span class="fare-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-airline-amber"
						></span>
						<p class="font-mono text-[9px] tracking-wider text-airline-amber/70">SEARCHING FARES</p>
						{#if flightDayProgress && flightDayProgress.totalDays > 1}
							<p class="mt-0.5 font-mono text-[8px] tracking-wider text-slate-400">
								DAY {flightDayProgress.daysCompleted} OF {flightDayProgress.totalDays}
							</p>
						{/if}
					</div>
				{:else if !isDriveable && !cheapestFlight && flightFallbackUrl}
					<div class="text-center">
						<p class="mb-1 text-[9px] text-slate-400">Prices unavailable</p>
						<a
							href={flightFallbackUrl}
							target="_blank"
							rel="noopener noreferrer external"
							class="font-mono text-[9px] tracking-wider text-airline-sky underline-offset-2 transition-colors hover:text-airline-sky-light hover:underline"
						>
							CHECK GOOGLE FLIGHTS →
						</a>
					</div>
				{/if}

				<a
					href={competition.url?.startsWith('https://') ? competition.url : '#'}
					target="_blank"
					rel="noopener noreferrer external"
					class="font-mono text-[10px] tracking-wider text-airline-sky underline-offset-2 transition-colors hover:text-airline-sky-light hover:underline"
				>
					VIEW DETAILS →
				</a>
			</div>
		</div>
	</div>
</article>

<style>
	.tear-line {
		background-image: repeating-linear-gradient(
			to bottom,
			#cbd5e1 0px,
			#cbd5e1 5px,
			transparent 5px,
			transparent 10px
		);
	}
	.tear-line-horizontal {
		background-image: repeating-linear-gradient(
			to right,
			#cbd5e1 0px,
			#cbd5e1 5px,
			transparent 5px,
			transparent 10px
		);
	}
	.tear-notch-top,
	.tear-notch-bottom {
		position: absolute;
		width: 16px;
		height: 16px;
		background: var(--color-airline-midnight);
		border-radius: 50%;
		left: -8px;
		z-index: 1;
	}
	.tear-notch-top {
		top: -8px;
	}
	.tear-notch-bottom {
		bottom: -8px;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	.status-dot {
		animation: pulse-dot 2s ease-in-out infinite;
	}
	.fare-dot {
		animation: pulse-dot 1s ease-in-out infinite;
	}

	@keyframes fade-done {
		0% {
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
	.refresh-done {
		animation: fade-done 2.5s ease-out forwards;
	}
</style>
