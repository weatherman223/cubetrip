// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Short correlation id shared between the request info log, the error log, and the X-Request-Id header. */
			requestId?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Ambient declaration for JSON imports via $lib alias.
// Vite handles these natively at build time, but svelte-check uses
// TypeScript's resolver which can't find JSON through path aliases.
declare module '*.json' {
	const value: unknown;
	export default value;
}

export {};
