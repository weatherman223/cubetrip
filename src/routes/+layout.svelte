<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CubeTrip — Find Your Next Competition</title>
</svelte:head>

<a
	href="#main-content"
	class="sr-only z-[9999] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:rounded-lg focus:bg-airline-amber focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold focus:text-airline-midnight"
	>Skip to main content</a
>

<div
	class="min-h-screen bg-gradient-to-b from-airline-midnight to-airline-navy font-sans text-white"
>
	{@render children()}

	<footer class="border-t border-airline-slate/20 px-4 py-6">
		<div class="mx-auto max-w-5xl text-center">
			<a
				href={resolve('/privacy')}
				class="font-mono text-[9px] tracking-widest text-slate-600 uppercase transition-colors hover:text-slate-400"
			>
				Privacy Notice
			</a>
		</div>
	</footer>
</div>
