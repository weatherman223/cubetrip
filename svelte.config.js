import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		csp: {
			mode: 'nonce',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Nonce mode auto-injects a per-request nonce into style-src; per CSP3
				// a nonce source invalidates 'unsafe-inline' on the same directive, so
				// we scope 'unsafe-inline' to style-src-attr (inline style="..." on
				// Leaflet popups, home marker, loading/skeleton animation-delay, etc.).
				// <style> blocks still require the nonce, preserving SSR isolation.
				'style-src': ['self', 'https://fonts.googleapis.com', 'https://cdn.cubing.net'],
				'style-src-attr': ['unsafe-inline'],
				'font-src': ['self', 'https://fonts.gstatic.com', 'https://cdn.cubing.net'],
				'img-src': ['self', 'data:', 'https://*.tile.openstreetmap.org'],
				'connect-src': ['self']
			}
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
