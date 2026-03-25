<script lang="ts">
	let statusIndex = $state(0);
	const statuses = [
		'CONNECTING TO WCA SYSTEMS',
		'LOADING DEPARTURES',
		'FETCHING REGISTRATION DATA',
		'PREPARING DEPARTURE BOARD'
	];

	$effect(() => {
		const interval = setInterval(() => {
			statusIndex = (statusIndex + 1) % statuses.length;
		}, 2000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4">
	<!-- CubeTrip logo -->
	<div class="boot-in mb-8 text-center">
		<span class="mb-2 block text-5xl">✈</span>
		<h1 class="font-mono text-3xl font-bold tracking-tight text-white">CubeTrip</h1>
		<p class="mt-1 font-mono text-xs tracking-[0.4em] text-airline-amber uppercase">
			FLIGHT SYSTEMS
		</p>
	</div>

	<!-- Progress bar -->
	<div class="mb-6 h-0.5 w-64 overflow-hidden rounded-full bg-airline-slate/30" role="progressbar" aria-label="Loading competitions">
		<div class="progress-bar h-full rounded-full bg-airline-amber"></div>
	</div>

	<!-- Status text -->
	<div class="h-5 text-center" aria-live="polite" aria-atomic="true">
		<p
			class="status-text font-mono text-[11px] tracking-[0.2em] text-airline-slate-light uppercase"
		>
			{statuses[statusIndex]}
			<span class="dots"></span>
		</p>
	</div>

	<!-- System lines -->
	<div class="mt-8 space-y-1 text-center">
		<p
			class="sys-line font-mono text-[9px] tracking-wider text-airline-slate/60"
			style="animation-delay: 0.5s"
		>
			SYS CHECK OK
		</p>
		<p
			class="sys-line font-mono text-[9px] tracking-wider text-airline-slate/60"
			style="animation-delay: 1.2s"
		>
			WCA API v0 ENDPOINT READY
		</p>
		<p
			class="sys-line font-mono text-[9px] tracking-wider text-airline-slate/60"
			style="animation-delay: 1.8s"
		>
			CACHE LAYER ONLINE
		</p>
	</div>
</div>

<style>
	@keyframes boot-in {
		0% {
			opacity: 0;
			transform: translateY(10px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.boot-in {
		animation: boot-in 0.6s ease-out;
	}

	@keyframes progress {
		0% {
			width: 0%;
		}
		50% {
			width: 70%;
		}
		100% {
			width: 100%;
		}
	}
	.progress-bar {
		animation: progress 8s ease-in-out infinite;
	}

	@keyframes status-flicker {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
	.status-text {
		animation: status-flicker 2s ease-in-out infinite;
	}

	.dots::after {
		content: '';
		animation: dots 1.5s steps(4, end) infinite;
	}
	@keyframes dots {
		0% {
			content: '';
		}
		25% {
			content: '.';
		}
		50% {
			content: '..';
		}
		75% {
			content: '...';
		}
	}

	@keyframes sys-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.sys-line {
		opacity: 0;
		animation: sys-fade 0.4s ease-out forwards;
	}
</style>
