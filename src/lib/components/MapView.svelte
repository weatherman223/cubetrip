<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { Airport, CompFlightData } from '$lib/types';
	import { getStatusHex } from '$lib/utils/status-display';
	import { browser } from '$app/environment';

	let {
		competitions,
		distances = new Map(),
		driveableRadius = 300,
		unit = 'miles',
		flights = new Map(),
		homeLatitude = null,
		homeLongitude = null,
		additionalHomeAirports = []
	}: {
		competitions: EnrichedCompetition[];
		distances?: Map<string, number>;
		driveableRadius?: number;
		unit?: string;
		flights?: Map<string, CompFlightData>;
		homeLatitude?: number | null;
		homeLongitude?: number | null;
		additionalHomeAirports?: Airport[];
	} = $props();

	let colorMode = $state<'status' | 'travel'>('status');

	let mapContainer: HTMLDivElement | undefined;
	let mapInstance: L.Map | undefined;
	let markersLayer: L.LayerGroup | undefined;
	let homeMarkers: L.Marker[] = [];
	let radiusCircles: L.Circle[] = [];

	// Dynamic import to avoid SSR issues
	type L = typeof import('leaflet');
	let L: L | undefined;

	$effect(() => {
		if (!browser || !mapContainer) return;

		let cancelled = false;

		(async () => {
			const leaflet = await import('leaflet');
			if (cancelled) return;
			L = leaflet.default;

			if (mapInstance) {
				mapInstance.remove();
			}

			mapInstance = L.map(mapContainer).setView([20, 0], 2);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 18
			}).addTo(mapInstance);

			markersLayer = L.layerGroup().addTo(mapInstance);
			updateMarkers();
		})();

		return () => {
			cancelled = true;
			if (mapInstance) {
				mapInstance.remove();
				mapInstance = undefined;
			}
		};
	});

	// Update markers when data changes
	$effect(() => {
		// Access reactive deps to track them
		void [
			competitions,
			distances,
			flights,
			homeLatitude,
			homeLongitude,
			driveableRadius,
			colorMode
		];

		if (mapInstance && L && markersLayer) {
			updateMarkers();
		}
	});

	/** Create an SVG marker icon with a distinct shape per status/category. */
	function markerSvg(color: string, shape: 'circle' | 'diamond' | 'square' | 'x' | 'ring'): string {
		const s = 20; // viewBox size
		switch (shape) {
			case 'circle':
				return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="10" cy="10" r="7" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
			case 'diamond':
				return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="10,2 18,10 10,18 2,10" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
			case 'square':
				return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="3" y="3" width="14" height="14" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
			case 'x':
				return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><line x1="4" y1="4" x2="16" y2="16" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/><line x1="16" y1="4" x2="4" y2="16" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/></svg>`;
			case 'ring':
				return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="10" cy="10" r="7" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="3 2"/></svg>`;
		}
	}

	type MarkerShape = 'circle' | 'diamond' | 'square' | 'x' | 'ring';

	/** Map registration status to a distinct shape. */
	function statusShape(status: string | undefined, isCancelled: boolean): MarkerShape {
		if (isCancelled) return 'x';
		switch (status) {
			case 'open':
			case 'on-the-spot':
				return 'circle';
			case 'waitlist':
				return 'diamond';
			case 'not-open-yet':
				return 'ring';
			case 'closed':
				return 'square';
			default:
				return 'ring'; // unknown
		}
	}

	/** Map travel category to a distinct shape. */
	function travelShape(isDriveable: boolean, hasFlight: boolean): MarkerShape {
		if (isDriveable) return 'circle';
		if (hasFlight) return 'diamond';
		return 'ring'; // no data
	}

	function updateMarkers() {
		if (!L || !mapInstance || !markersLayer) return;

		markersLayer.clearLayers();
		for (const m of homeMarkers) m.remove();
		homeMarkers = [];
		for (const c of radiusCircles) c.remove();
		radiusCircles = [];

		const bounds: L.LatLngExpression[] = [];

		// Render one marker + driveable-radius circle per home (primary + additionals).
		// Primary is always first so the bounds calculation includes it even when the
		// user hasn't picked any additionals.
		const homes: Array<{ lat: number; lng: number; iata: string | null; primary: boolean }> = [];
		if (homeLatitude !== null && homeLongitude !== null) {
			homes.push({ lat: homeLatitude, lng: homeLongitude, iata: null, primary: true });
		}
		for (const a of additionalHomeAirports) {
			homes.push({ lat: a.latitude, lng: a.longitude, iata: a.iata, primary: false });
		}

		const radiusKm = unit === 'km' ? driveableRadius : driveableRadius * 1.60934;
		const homeIcon = L.divIcon({
			html: '<div style="font-size:24px;text-align:center;line-height:1">🏠</div>',
			iconSize: [30, 30],
			iconAnchor: [15, 15],
			className: ''
		});
		for (const h of homes) {
			const popupHtml = h.primary
				? '<strong style="font-family:monospace">HOME BASE</strong>'
				: `<strong style="font-family:monospace">ALSO SEARCHING${h.iata ? ' — ' + h.iata : ''}</strong>`;
			const marker = L.marker([h.lat, h.lng], { icon: homeIcon })
				.addTo(mapInstance)
				.bindPopup(popupHtml);
			// Leaflet markers are keyboard-focusable; give each an accessible name
			// (the `alt` option only applies to img icons, not divIcons).
			marker
				.getElement()
				?.setAttribute('aria-label', h.primary ? 'Home base' : `Also searching — ${h.iata ?? ''}`);
			homeMarkers.push(marker);

			const circle = L.circle([h.lat, h.lng], {
				radius: radiusKm * 1000,
				color: '#22c55e',
				fillColor: '#22c55e',
				fillOpacity: 0.06,
				weight: 1,
				dashArray: '6 4'
			}).addTo(mapInstance);
			radiusCircles.push(circle);

			bounds.push([h.lat, h.lng]);
		}

		// Competition markers
		for (const comp of competitions) {
			const dist = distances.get(comp.id) ?? null;
			const isDriveable = dist !== null && dist <= driveableRadius;
			const flightData = flights.get(comp.id);
			const hasFlight = !!flightData?.primary;

			let color: string;
			let shape: MarkerShape;
			if (colorMode === 'status') {
				color = getStatusHex(comp.wcif?.registrationStatus, comp.cancelled_at !== null).color;
				shape = statusShape(comp.wcif?.registrationStatus, comp.cancelled_at !== null);
			} else {
				color = '#94a3b8';
				if (isDriveable) color = '#22c55e';
				else if (hasFlight) color = '#38bdf8';
				shape = travelShape(isDriveable, hasFlight);
			}

			const icon = L.divIcon({
				html: markerSvg(color, shape),
				iconSize: [20, 20],
				iconAnchor: [10, 10],
				className: ''
			});
			const marker = L.marker([comp.latitude_degrees, comp.longitude_degrees], { icon }).addTo(
				markersLayer!
			);
			marker.getElement()?.setAttribute('aria-label', comp.name);

			// Build popup
			const price = flightData?.primary?.flight.price;
			const distLabel = dist !== null ? `${Math.round(dist)} ${unit}` : '';
			const travelInfo = isDriveable
				? `🚗 ${distLabel}`
				: price
					? `✈ $${price}`
					: distLabel
						? `✈ ${distLabel}`
						: '';

			const { label: statusLabel, color: badgeColor } = getStatusHex(
				comp.wcif?.registrationStatus,
				comp.cancelled_at !== null
			);

			const esc = (s: string) =>
				s
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');
			const safeUrl = comp.url?.startsWith('https://') ? esc(comp.url) : '#';
			marker.bindPopup(`
				<div style="font-family:'JetBrains Mono',monospace;min-width:180px">
					<div style="font-size:13px;font-weight:bold;margin-bottom:4px">${esc(comp.name)}</div>
					<div style="font-size:11px;color:#64748b;margin-bottom:6px">${esc(comp.city)} · ${esc(comp.date_range)}</div>
					<span style="display:inline-block;background:${esc(badgeColor)};color:#0f172a;font-size:9px;padding:1px 6px;border-radius:9px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">${esc(statusLabel)}</span>
					${travelInfo ? `<div style="font-size:12px;font-weight:bold;color:#f59e0b;margin-top:4px">${esc(travelInfo)}</div>` : ''}
					<div style="margin-top:6px">
						<a href="${safeUrl}" target="_blank" style="font-size:10px;color:#38bdf8;text-decoration:none">VIEW ON WCA →</a>
					</div>
				</div>
			`);

			bounds.push([comp.latitude_degrees, comp.longitude_degrees]);
		}

		// Fit bounds
		if (bounds.length > 0) {
			mapInstance.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), {
				padding: [30, 30],
				maxZoom: 12
			});
		}
	}
</script>

<div class="relative">
	<!-- Color mode toggle -->
	<div class="mb-2 flex items-center gap-1 font-mono text-[10px] tracking-wider">
		<span class="mr-1 text-airline-slate-light uppercase">Color by:</span>
		<button
			aria-pressed={colorMode === 'status'}
			onclick={() => (colorMode = 'status')}
			class="rounded-full px-3 py-1 transition-colors {colorMode === 'status'
				? 'bg-airline-amber text-airline-midnight'
				: 'bg-airline-navy text-airline-slate-light hover:bg-airline-slate/20'}">STATUS</button
		>
		<button
			aria-pressed={colorMode === 'travel'}
			onclick={() => (colorMode = 'travel')}
			class="rounded-full px-3 py-1 transition-colors {colorMode === 'travel'
				? 'bg-airline-amber text-airline-midnight'
				: 'bg-airline-navy text-airline-slate-light hover:bg-airline-slate/20'}">TRAVEL</button
		>
	</div>

	<div
		bind:this={mapContainer}
		role="region"
		aria-label="Competition map"
		class="h-[300px] w-full overflow-hidden rounded-xl border border-airline-slate/30 shadow-lg sm:h-[400px] md:h-[500px]"
	></div>

	<!-- Legend overlay -->
	<div
		class="absolute bottom-3 left-3 z-[1000] rounded-lg bg-airline-midnight/90 px-3 py-2 font-mono text-[9px] tracking-wider text-white backdrop-blur-sm"
	>
		<!-- markerSvg() returns fully-controlled, hard-coded SVG with no user input;
			 the only dynamic values are the color string and shape enum, both from
			 literal call sites below. Safe to render as raw HTML. -->
		{#if colorMode === 'status'}
			<div class="mb-1 text-airline-slate-light uppercase">Registration</div>
			<div class="flex flex-col gap-0.5">
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#22c55e', 'circle')} BOARDING
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#eab308', 'circle')} STANDBY
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#f59e0b', 'diamond')} WAITLIST
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#94a3b8', 'square')} GATE CLOSED
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#ef4444', 'x')} CANCELLED
				</div>
			</div>
		{:else}
			<div class="mb-1 text-airline-slate-light uppercase">Travel Data</div>
			<div class="flex flex-col gap-0.5">
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#22c55e', 'circle')} Driveable
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#38bdf8', 'diamond')} Flight found
				</div>
				<div class="flex items-center gap-1.5">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html markerSvg('#94a3b8', 'ring')} No data yet
				</div>
			</div>
		{/if}
	</div>
</div>
