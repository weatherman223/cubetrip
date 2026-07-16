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

// One row per status: hex tokens for Leaflet markers/popups, Tailwind classes
// for Svelte components. Badges pair white text with the darkened "-deep"
// status backgrounds (all >=4.9:1, WCAG AA at 10px) — the bright base tokens
// fail with white text (green/yellow/amber sit at ~1.9-2.3:1) and stay
// reserved for status dots and map markers, which sit on light surfaces.
interface StatusRow {
	label: string;
	color: string;
	deep: string;
	bg: string;
	dot: string;
}

const statusMap: Record<string, StatusRow> = {
	open: {
		label: 'BOARDING',
		color: '#22c55e',
		deep: '#15803d',
		bg: 'bg-airline-open-deep',
		dot: 'bg-airline-open'
	},
	'on-the-spot': {
		label: 'STANDBY',
		color: '#eab308',
		deep: '#a16207',
		bg: 'bg-airline-standby-deep',
		dot: 'bg-airline-standby'
	},
	waitlist: {
		label: 'WAITLIST',
		color: '#f59e0b',
		deep: '#b45309',
		bg: 'bg-airline-waitlist-deep',
		dot: 'bg-airline-amber'
	},
	'not-open-yet': {
		label: 'PREBOARDING',
		color: '#3b82f6',
		deep: '#2563eb',
		bg: 'bg-airline-upcoming-deep',
		dot: 'bg-airline-upcoming'
	},
	closed: {
		label: 'GATE CLOSED',
		color: '#94a3b8',
		deep: '#475569',
		bg: 'bg-airline-closed-deep',
		dot: 'bg-airline-closed'
	},
	cancelled: {
		label: 'CANCELLED',
		color: '#ef4444',
		deep: '#b91c1c',
		bg: 'bg-airline-cancelled-deep',
		dot: 'bg-airline-cancelled'
	}
};

const defaultRow: StatusRow = {
	label: 'CHECKING STATUS',
	color: '#94a3b8',
	deep: '#334155',
	bg: 'bg-airline-slate',
	dot: 'bg-airline-amber'
};

function rowFor(status: RegistrationStatus | string | undefined, isCancelled: boolean): StatusRow {
	if (isCancelled) return statusMap.cancelled;
	if (!status) return defaultRow;
	return statusMap[status] ?? defaultRow;
}

/** Get hex color + label for a registration status (used in Leaflet popups/markers). */
export function getStatusHex(
	status: RegistrationStatus | string | undefined,
	isCancelled = false
): StatusDisplayHex {
	const { label, color, deep } = rowFor(status, isCancelled);
	return { label, color, deep };
}

/** Get Tailwind classes + label for a registration status (used in Svelte components). */
export function getStatusTailwind(
	status: RegistrationStatus | string | undefined,
	isCancelled = false
): StatusDisplayTailwind {
	const { label, bg, dot } = rowFor(status, isCancelled);
	return { label, color: bg, dot, text: 'text-white' };
}
