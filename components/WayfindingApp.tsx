'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { useMapData } from '@mappedin/react-sdk';
import '@mappedin/mappedin-js/lib/index.css';
import { getMapCredentials, type MapCredentials } from '@/lib/actions/mappedin';
import { MallExperience } from './MallExperience';

function LoadingScreen({ message }: { message: string }) {
	return (
		<main className="grid h-dvh place-items-center bg-canvas px-6" aria-busy="true">
			<div className="flex flex-col items-center gap-4 text-center">
				<span className="loader" aria-hidden="true" />
				<p className="text-sm text-muted">{message}</p>
			</div>
		</main>
	);
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<main className="grid h-dvh place-items-center bg-canvas px-6">
			<div className="flex max-w-sm flex-col items-center gap-4 text-center">
				<h1 className="text-xl font-semibold text-ink">We couldn&apos;t load the mall map</h1>
				<p className="text-sm text-muted">{message}</p>
				<button type="button" onClick={onRetry} className="tap h-12 rounded-2xl bg-brand px-6 font-semibold text-white">
					Try again
				</button>
			</div>
		</main>
	);
}

function MapLoader({ credentials }: { credentials: MapCredentials }) {
	const { mapData, isLoading, error } = useMapData({
		accessToken: credentials.accessToken,
		mapId: credentials.mapId,
	});
	if (error) return <ErrorScreen message={error.message} onRetry={() => window.location.reload()} />;
	if (isLoading || !mapData) return <LoadingScreen message="Loading the mall map…" />;
	return <MallExperience mapData={mapData} />;
}

export default function WayfindingApp() {
	const [credentials, setCredentials] = useState<MapCredentials>();
	const [error, setError] = useState<string>();

	const fetchCredentials = useCallback(() => {
		startTransition(async () => {
			try {
				const result = await getMapCredentials();
				setCredentials(result);
			} catch {
				setError('Check your connection and try again.');
			}
		});
	}, []);

	useEffect(fetchCredentials, [fetchCredentials]);

	const retry = () => {
		setError(undefined);
		fetchCredentials();
	};

	if (error) return <ErrorScreen message={error} onRetry={retry} />;
	if (!credentials) return <LoadingScreen message="Getting directions ready…" />;
	return <MapLoader credentials={credentials} />;
}
