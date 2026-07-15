import type { RegistrationStatus } from '$lib/server/wca/types';

export interface StatusDisplayHex {
	label: string;
	color: string; // hex color for Leaflet/canvas contexts
}

export interface StatusDisplayTailwind {
	label: string;
	color: string; // Tailwind bg class
	dot: string; // Tailwind bg class for status dot
	text: string; // Tailwind text class with WCAG-AA contrast against `color`
}

const hexMap: Record<string, StatusDisplayHex> = {
	open: { label: 'BOARDING', color: '#22c55e' },
	'on-the-spot': { label: 'STANDBY', color: '#eab308' },
	waitlist: { label: 'WAITLIST', color: '#f59e0b' },
	'not-open-yet': { label: 'PREBOARDING', color: '#3b82f6' },
	closed: { label: 'GATE CLOSED', color: '#94a3b8' },
	cancelled: { label: 'CANCELLED', color: '#ef4444' }
};

const defaultHex: StatusDisplayHex = { label: 'CHECKING STATUS', color: '#94a3b8' };

// All mapped status backgrounds are light enough that white 10px text fails
// WCAG AA (green/yellow/amber sit at ~1.6-1.9:1); dark midnight text passes
// >=4.5:1 on every one. Only the slate "checking" default is a dark bg where
// white remains the readable choice.
const tailwindMap: Record<string, StatusDisplayTailwind> = {
	open: {
		label: 'BOARDING',
		color: 'bg-airline-open',
		dot: 'bg-airline-open',
		text: 'text-airline-midnight'
	},
	'on-the-spot': {
		label: 'STANDBY',
		color: 'bg-airline-standby',
		dot: 'bg-airline-standby',
		text: 'text-airline-midnight'
	},
	waitlist: {
		label: 'WAITLIST',
		color: 'bg-airline-amber',
		dot: 'bg-airline-amber',
		text: 'text-airline-midnight'
	},
	'not-open-yet': {
		label: 'PREBOARDING',
		color: 'bg-airline-upcoming',
		dot: 'bg-airline-upcoming',
		text: 'text-airline-midnight'
	},
	closed: {
		label: 'GATE CLOSED',
		color: 'bg-airline-closed',
		dot: 'bg-airline-closed',
		text: 'text-airline-midnight'
	},
	cancelled: {
		label: 'CANCELLED',
		color: 'bg-airline-cancelled',
		dot: 'bg-airline-cancelled',
		text: 'text-airline-midnight'
	}
};

const defaultTailwind: StatusDisplayTailwind = {
	label: 'CHECKING STATUS',
	color: 'bg-airline-slate',
	dot: 'bg-airline-amber',
	text: 'text-white'
};

/** Get hex color + label for a registration status (used in Leaflet popups/markers). */
export function getStatusHex(
	status: RegistrationStatus | string | undefined,
	isCancelled = false
): StatusDisplayHex {
	if (isCancelled) return hexMap.cancelled;
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
