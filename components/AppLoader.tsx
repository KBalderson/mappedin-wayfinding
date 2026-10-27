'use client';

import dynamic from 'next/dynamic';

// The Mappedin SDK needs WebGL, workers and `window`, so it only ever runs in the browser.
const WayfindingApp = dynamic(() => import('./WayfindingApp'), {
	ssr: false,
	loading: () => (
		<main className="grid h-dvh place-items-center bg-canvas" aria-busy="true">
			<span className="loader" aria-hidden="true" />
		</main>
	),
});

export default function AppLoader() {
	return <WayfindingApp />;
}
