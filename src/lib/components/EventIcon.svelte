<script lang="ts">
	import { EVENT_NAMES } from '$lib/utils/events';

	let { eventId }: { eventId: string } = $props();

	const label = $derived(EVENT_NAMES[eventId] ?? eventId);
</script>

<span class="cubing-icon event-{eventId}" title={label} aria-label={label}></span>
