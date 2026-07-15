import type { RegistrationStatus } from '$lib/server/wca/types';

export interface StatusDisplayHex {
	label: string;
	color: string; // bright hex for map markers (sits on light tiles)
	deep: string; // darkened hex for badge backgrounds with white text (>=4.5:1)
}

export interface StatusDisplayTailwind {
	label: string;
	color: string; // Tailwind bg class
	dot: string; // Tailwind bg class for status dot
	text: string; // Tailwind text class with WCAG-AA contrast against `color`
}

const hexMap: Record<string, StatusDisplayHex> = {
	open: { label: 'BOARDING', color: '#22c55e', deep: '#15803d' },
	'on-the-spot': { label: 'STANDBY', color: '#eab308', deep: '#a16207' },
	waitlist: { label: 'WAITLIST', color: '#f59e0b', deep: '#b45309' },
	'not-open-yet': { label: 'PREBOARDING', color: '#3b82f6', deep: '#2563eb' },
	closed: { label: 'GATE CLOSED', color: '#94a3b8', deep: '#475569' },
	cancelled: { label: 'CANCELLED', color: '#ef4444', deep: '#b91c1c' }
};

const defaultHex: StatusDisplayHex = {
	label: 'CHECKING STATUS',
	color: '#94a3b8',
	deep: '#334155'
};

// Badges pair white text with the darkened "-deep" status backgrounds (all
// >=4.9:1, WCAG AA at 10px) — the bright base tokens fail with white text
// (green/yellow/amber sit at ~1.9-2.3:1) and stay reserved for status dots
// and map markers, which sit on light surfaces.
const tailwindMap: Record<string, StatusDisplayTailwind> = {
	open: {
		label: 'BOARDING',
		color: 'bg-airline-open-deep',
		dot: 'bg-airline-open',
		text: 'text-white'
	},
	'on-the-spot': {
		label: 'STANDBY',
		color: 'bg-airline-standby-deep',
		dot: 'bg-airline-standby',
		text: 'text-white'
	},
	waitlist: {
		label: 'WAITLIST',
		color: 'bg-airline-waitlist-deep',
		dot: 'bg-airline-amber',
		text: 'text-white'
	},
	'not-open-yet': {
		label: 'PREBOARDING',
		color: 'bg-airline-upcoming-deep',
		dot: 'bg-airline-upcoming',
		text: 'text-white'
	},
	closed: {
		label: 'GATE CLOSED',
		color: 'bg-airline-closed-deep',
		dot: 'bg-airline-closed',
		text: 'text-white'
	},
	cancelled: {
		label: 'CANCELLED',
		color: 'bg-airline-cancelled-deep',
		dot: 'bg-airline-cancelled',
		text: 'text-white'
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
