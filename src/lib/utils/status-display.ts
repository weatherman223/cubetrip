import type { RegistrationStatus } from '$lib/server/wca/types';

export interface StatusDisplayHex {
	label: string;
	color: string; // hex color for Leaflet/canvas contexts
}

export interface StatusDisplayTailwind {
	label: string;
	color: string; // Tailwind bg class
	dot: string; // Tailwind bg class for status dot
}

const hexMap: Record<string, StatusDisplayHex> = {
	open: { label: 'BOARDING', color: '#22c55e' },
	'on-the-spot': { label: 'STANDBY', color: '#eab308' },
	waitlist: { label: 'WAITLIST', color: '#f59e0b' },
	closed: { label: 'GATE CLOSED', color: '#94a3b8' },
	cancelled: { label: 'CANCELLED', color: '#ef4444' }
};

const defaultHex: StatusDisplayHex = { label: 'CHECKING STATUS', color: '#94a3b8' };

const tailwindMap: Record<string, StatusDisplayTailwind> = {
	open: { label: 'BOARDING', color: 'bg-airline-open', dot: 'bg-airline-open' },
	'on-the-spot': { label: 'STANDBY', color: 'bg-airline-standby', dot: 'bg-airline-standby' },
	waitlist: { label: 'WAITLIST', color: 'bg-airline-amber', dot: 'bg-airline-amber' },
	closed: { label: 'GATE CLOSED', color: 'bg-airline-closed', dot: 'bg-airline-closed' },
	cancelled: { label: 'CANCELLED', color: 'bg-airline-cancelled', dot: 'bg-airline-cancelled' }
};

const defaultTailwind: StatusDisplayTailwind = {
	label: 'CHECKING STATUS',
	color: 'bg-airline-slate',
	dot: 'bg-airline-amber'
};

/** Get hex color + label for a registration status (used in Leaflet popups/markers). */
export function getStatusHex(status: RegistrationStatus | string | undefined): StatusDisplayHex {
	if (!status) return defaultHex;
	return hexMap[status] ?? defaultHex;
}

/** Get Tailwind classes + label for a registration status (used in Svelte components). */
export function getStatusTailwind(
	status: RegistrationStatus | string | undefined,
	isCancelled = false
): StatusDisplayTailwind {
	if (isCancelled) return tailwindMap.cancelled;
	if (!status) return defaultTailwind;
	return tailwindMap[status] ?? defaultTailwind;
}
