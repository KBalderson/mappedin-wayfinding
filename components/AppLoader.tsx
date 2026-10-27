'use client';

import dynamic from 'next/dynamic';
import { VasaLogo } from './ui/icons';

// The Mappedin SDK needs WebGL, workers and `window`, so it only ever runs in the browser.
const WayfindingApp = dynamic(() => import('./WayfindingApp'), {
	ssr: false,
	loading: () => (
		<main className="flex h-dvh flex-col items-center justify-center gap-6 bg-canvas" aria-busy="true">
			<VasaLogo className="size-16 text-brand" />
			<span className="loader" aria-hidden="true" />
		</main>
	),
});

export default function AppLoader() {
	return <WayfindingApp />;
}
