import { json } from '@sveltejs/kit';

export type ApiErrorCode =
	| 'MISSING_PARAMETER'
	| 'INVALID_PARAMETER'
	| 'INVALID_QUERY'
	| 'QUEUE_FULL'
	| 'UPSTREAM_UNAVAILABLE'
	| 'SCRAPE_UNAVAILABLE'
	| 'INTERNAL_ERROR';

export function apiError(
	code: ApiErrorCode,
	error: string,
	status: number,
	extra?: Record<string, unknown>,
	headers?: HeadersInit
) {
	return json({ error, code, ...extra }, { status, headers });
}
