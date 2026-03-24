<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CubeTrip — Find Your Next Competition</title>
</svelte:head>

<div
	class="min-h-screen bg-gradient-to-b from-airline-midnight to-airline-navy font-sans text-white"
>
	{@render children()}
</div>
