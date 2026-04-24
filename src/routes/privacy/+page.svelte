<svelte:head>
	<title>Privacy Notice - CubeTrip</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12">
	<a
		href="/"
		class="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-slate-500 uppercase transition-colors hover:text-airline-amber"
	>
		&larr; Back to CubeTrip
	</a>

	<h1 class="mt-6 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
		Privacy Notice
	</h1>
	<p class="mt-1 text-[10px] text-slate-600">Last updated: March 2026</p>

	<div class="mt-8 space-y-8">
		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				What This Tool Does
			</h2>
			<p class="text-sm leading-relaxed text-slate-400">
				CubeTrip helps speedcubers find WCA competitions and estimate travel costs. It requires no
				account, uses no cookies, and does not track you.
			</p>
		</section>

		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				What Is Stored in Your Browser
			</h2>
			<ul class="space-y-1.5 text-sm leading-relaxed text-slate-400">
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						>Your preferences (home airport, driveable radius, distance unit, default events,
						partial attendance) are saved in
						<code class="text-slate-300">localStorage</code>.</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						>You can clear all stored data at any time using the "Clear All Data" button in
						Settings.</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No cookies are set.</span>
				</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				What Is Sent to the Server
			</h2>
			<ul class="space-y-1.5 text-sm leading-relaxed text-slate-400">
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						>Your home airport code is sent as a query parameter when searching for flights.</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>Date ranges are sent when searching for competitions.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>Airport name fragments are sent when using the airport search.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						>None of this data is logged to disk, stored in a database, or associated with any user
						identifier. The server has no concept of user accounts or sessions.</span
					>
				</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				Third-Party Data Sources
			</h2>
			<ul class="space-y-1.5 text-sm leading-relaxed text-slate-400">
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						><strong class="text-slate-300">WCA API</strong>
						(worldcubeassociation.org) &mdash; competition listings and public schedule data are fetched
						server-side. No user data is sent to the WCA.</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						><strong class="text-slate-300">Google Flights</strong> &mdash; flight prices are retrieved
						server-side. Only airport codes and dates are sent to Google; no user data is included.</span
					>
				</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				Server-Side Caching
			</h2>
			<!-- Cache TTLs sourced from src/lib/server/cache/constants.ts -->
			<ul class="space-y-1.5 text-sm leading-relaxed text-slate-400">
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>Competition data is cached for 1 hour.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>Schedule/registration data (WCIF) is cached for 2 hours.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>Flight prices are cached for 12 hours.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span
						>All cached data is competition and route information, not user data. Expired entries
						are cleaned automatically.</span
					>
				</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-3 font-mono text-[10px] tracking-[0.3em] text-airline-amber uppercase">
				What We Don't Do
			</h2>
			<ul class="space-y-1.5 text-sm leading-relaxed text-slate-400">
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No user tracking or analytics</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No cookies</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No advertising</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No data sharing with third parties</span>
				</li>
				<li class="flex gap-2">
					<span class="text-slate-600">-</span>
					<span>No personal data collection or storage</span>
				</li>
			</ul>
		</section>
	</div>

	<p class="mt-10 text-[10px] text-slate-600">CubeTrip is an open-source hobby project.</p>
</div>
