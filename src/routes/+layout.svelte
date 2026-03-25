<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CubeTrip — Find Your Next Competition</title>
</svelte:head>

<a
	href="#main-content"
	class="sr-only z-[9999] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-airline-amber focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold focus:text-airline-midnight"
>Skip to results</a>

<div
	class="min-h-screen bg-gradient-to-b from-airline-midnight to-airline-navy font-sans text-white"
>
	{@render children()}
</div>
