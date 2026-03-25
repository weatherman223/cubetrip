<script lang="ts">
	import type { EnrichedCompetition } from '$lib/server/wca/types';
	import type { FlightResult } from '$lib/server/flights/types';
	import { browser } from '$app/environment';

	interface AirportFlight {
		flight: FlightResult;
		fetchedAt: string;
		fallbackUrl: string | null;
	}

	interface CompFlightData {
		primary: AirportFlight | null;
		cheaperAlt: AirportFlight | null;
		fallbackUrl: string | null;
	}

	let {
		competitions,
		distances = new Map(),
		driveableRadius = 300,
		unit = 'miles',
		flights = new Map(),
		homeLatitude = null,
		homeLongitude = null
	}: {
		competitions: EnrichedCompetition[];
		distances?: Map<string, number>;
		driveableRadius?: number;
		unit?: string;
		flights?: Map<string, CompFlightData>;
		homeLatitude?: number | null;
		homeLongitude?: number | null;
	} = $props();

	let colorMode = $state<'status' | 'travel'>('status');

	let mapContainer: HTMLDivElement | undefined;
	let mapInstance: L.Map | undefined;
	let markersLayer: L.LayerGroup | undefined;
	let homeMarker: L.Marker | undefined;
	let radiusCircle: L.Circle | undefined;

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
		competitions;
		distances;
		flights;
		homeLatitude;
		homeLongitude;
		driveableRadius;
		colorMode;

		if (mapInstance && L && markersLayer) {
			updateMarkers();
		}
	});

	function updateMarkers() {
		if (!L || !mapInstance || !markersLayer) return;

		markersLayer.clearLayers();
		if (homeMarker) {
			homeMarker.remove();
			homeMarker = undefined;
		}
		if (radiusCircle) {
			radiusCircle.remove();
			radiusCircle = undefined;
		}

		const bounds: L.LatLngExpression[] = [];

		// Home marker + radius
		if (homeLatitude !== null && homeLongitude !== null) {
			const homeIcon = L.divIcon({
				html: '<div style="font-size:24px;text-align:center;line-height:1">🏠</div>',
				iconSize: [30, 30],
				iconAnchor: [15, 15],
				className: ''
			});
			homeMarker = L.marker([homeLatitude, homeLongitude], { icon: homeIcon })
				.addTo(mapInstance)
				.bindPopup('<strong style="font-family:monospace">HOME BASE</strong>');
			bounds.push([homeLatitude, homeLongitude]);

			// Driveable radius circle
			const radiusKm = unit === 'km' ? driveableRadius : driveableRadius * 1.60934;
			radiusCircle = L.circle([homeLatitude, homeLongitude], {
				radius: radiusKm * 1000,
				color: '#22c55e',
				fillColor: '#22c55e',
				fillOpacity: 0.06,
				weight: 1,
				dashArray: '6 4'
			}).addTo(mapInstance);
		}

		// Competition markers
		for (const comp of competitions) {
			const dist = distances.get(comp.id) ?? null;
			const isDriveable = dist !== null && dist <= driveableRadius;
			const flightData = flights.get(comp.id);
			const hasFlight = !!flightData?.primary;

			let color: string;
			if (colorMode === 'status') {
				// Color by registration status
				const isCancelled = comp.cancelled_at !== null;
				const status = comp.wcif?.registrationStatus;
				if (isCancelled) color = '#ef4444';
				else if (status === 'open') color = '#22c55e';
				else if (status === 'on-the-spot') color = '#eab308';
				else if (status === 'waitlist') color = '#f59e0b';
				else if (status === 'closed') color = '#94a3b8';
				else color = '#94a3b8';
			} else {
				// Color by travel data: green=driveable, blue=has flights, gray=no data
				color = '#94a3b8';
				if (isDriveable) color = '#22c55e';
				else if (hasFlight) color = '#38bdf8';
			}

			const marker = L.circleMarker([comp.latitude_degrees, comp.longitude_degrees], {
				radius: 8,
				color: color,
				fillColor: color,
				fillOpacity: 0.8,
				weight: 2
			}).addTo(markersLayer!);

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

			const rawStatus = comp.wcif?.registrationStatus ?? 'unknown';
			const statusDisplay: Record<string, { label: string; color: string }> = {
				open: { label: 'BOARDING', color: '#22c55e' },
				'on-the-spot': { label: 'STANDBY', color: '#eab308' },
				waitlist: { label: 'WAITLIST', color: '#f59e0b' },
				closed: { label: 'GATE CLOSED', color: '#94a3b8' }
			};
			const { label: statusLabel, color: badgeColor } = statusDisplay[rawStatus] ?? {
				label: 'CHECKING STATUS',
				color: '#94a3b8'
			};

			const esc = (s: string) =>
				s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
			const safeUrl = comp.url?.startsWith('https://') ? esc(comp.url) : '#';
			marker.bindPopup(`
				<div style="font-family:'JetBrains Mono',monospace;min-width:180px">
					<div style="font-size:13px;font-weight:bold;margin-bottom:4px">${esc(comp.name)}</div>
					<div style="font-size:11px;color:#64748b;margin-bottom:6px">${esc(comp.city)} · ${esc(comp.date_range)}</div>
					<span style="display:inline-block;background:${esc(badgeColor)};color:white;font-size:9px;padding:1px 6px;border-radius:9px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">${esc(statusLabel)}</span>
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
			onclick={() => colorMode = 'status'}
			class="rounded-full px-3 py-1 transition-colors {colorMode === 'status' ? 'bg-airline-amber text-airline-dark' : 'bg-airline-dark-card text-airline-slate-light hover:bg-airline-slate/20'}"
		>STATUS</button>
		<button
			onclick={() => colorMode = 'travel'}
			class="rounded-full px-3 py-1 transition-colors {colorMode === 'travel' ? 'bg-airline-amber text-airline-dark' : 'bg-airline-dark-card text-airline-slate-light hover:bg-airline-slate/20'}"
		>TRAVEL</button>
	</div>

	<div
		bind:this={mapContainer}
		class="h-[300px] w-full overflow-hidden rounded-xl border border-airline-slate/30 shadow-lg sm:h-[400px] md:h-[500px]"
	></div>

	<!-- Legend overlay -->
	<div class="absolute bottom-3 left-3 z-[1000] rounded-lg bg-airline-dark/90 px-3 py-2 font-mono text-[9px] tracking-wider text-white backdrop-blur-sm">
		{#if colorMode === 'status'}
			<div class="mb-1 text-airline-slate-light uppercase">Registration</div>
			<div class="flex flex-col gap-0.5">
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#22c55e"></span> BOARDING</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#eab308"></span> STANDBY</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#f59e0b"></span> WAITLIST</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#94a3b8"></span> GATE CLOSED</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#ef4444"></span> CANCELLED</div>
			</div>
		{:else}
			<div class="mb-1 text-airline-slate-light uppercase">Travel Data</div>
			<div class="flex flex-col gap-0.5">
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#22c55e"></span> Driveable</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#38bdf8"></span> Flight found</div>
				<div class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:#94a3b8"></span> No data yet</div>
			</div>
		{/if}
	</div>
</div>
