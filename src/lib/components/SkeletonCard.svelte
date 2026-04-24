<script lang="ts">
	let { delay = 0 }: { delay?: number } = $props();
</script>

<article
	class="skeleton-card overflow-hidden rounded-xl shadow-lg"
	style="animation-delay: {delay}ms"
>
	<div class="flex flex-col md:flex-row">
		<!-- Main section -->
		<div class="flex-1 bg-airline-paper p-5">
			<!-- FLIGHT label + name -->
			<div class="mb-4">
				<div class="mb-1.5 h-2.5 w-10 rounded-sm bg-slate-200"></div>
				<div class="shimmer h-5 w-3/4 rounded bg-slate-200"></div>
			</div>

			<!-- Location row: FROM, VENUE, GATE -->
			<div class="mb-4 flex flex-wrap items-start gap-x-6 gap-y-3">
				<div>
					<div class="mb-1.5 h-2.5 w-8 rounded-sm bg-slate-200"></div>
					<div class="shimmer h-4 w-28 rounded bg-slate-200"></div>
				</div>
				<div>
					<div class="mb-1.5 h-2.5 w-10 rounded-sm bg-slate-200"></div>
					<div class="shimmer h-4 w-36 rounded bg-slate-200"></div>
				</div>
				<div>
					<div class="mb-1.5 h-2.5 w-8 rounded-sm bg-slate-200"></div>
					<div class="shimmer h-4 w-10 rounded bg-slate-200"></div>
				</div>
			</div>

			<!-- EVENTS row -->
			<div>
				<div class="mb-2 h-2.5 w-12 rounded-sm bg-slate-200"></div>
				<div class="flex gap-2">
					{#each { length: 5 } as _, i (i)}
						<div class="shimmer h-6 w-6 rounded bg-slate-200"></div>
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
				<div class="mx-auto mb-1.5 h-2.5 w-8 rounded-sm bg-amber-100"></div>
				<div class="shimmer mx-auto h-4 w-24 rounded bg-amber-100"></div>
				<div class="shimmer mx-auto mt-1 h-4 w-16 rounded bg-amber-100"></div>
			</div>
			<div class="flex flex-col items-center gap-2">
				<div class="shimmer h-5 w-20 rounded-full bg-amber-100"></div>
				<div class="h-3 w-20 rounded bg-amber-50"></div>
			</div>
		</div>
	</div>
</article>

<style>
	@keyframes shimmer-sweep {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.skeleton-card {
		animation: fade-in 0.4s ease-out both;
	}

	.shimmer {
		background-image: linear-gradient(
			90deg,
			transparent 0%,
			rgba(245, 158, 11, 0.08) 40%,
			rgba(245, 158, 11, 0.15) 50%,
			rgba(245, 158, 11, 0.08) 60%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer-sweep 1.8s ease-in-out infinite;
	}

	.tear-line {
		background-image: repeating-linear-gradient(
			to bottom,
			#e2e8f0 0px,
			#e2e8f0 5px,
			transparent 5px,
			transparent 10px
		);
	}
	.tear-line-horizontal {
		background-image: repeating-linear-gradient(
			to right,
			#e2e8f0 0px,
			#e2e8f0 5px,
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
</style>
