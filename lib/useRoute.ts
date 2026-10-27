'use client';

import { useEffect, useState } from 'react';
import type { Directions, MapData } from '@mappedin/mappedin-js';
import { buildSteps, type Landmark, type Step } from './instructions';
import { outlineOf, toLatLon, toRawInstructions, type ParkingOrigin, type Store } from './mall';

export type Route =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'unavailable' }
	| { status: 'ready'; directions: Directions; steps: Step[]; distance: number };

type Result = { key: string; route: Route };

export function useRoute(
	mapData: MapData,
	origin: ParkingOrigin | undefined,
	store: Store | undefined,
	landmarks: Landmark[],
	floorNames: Record<string, string>,
): Route {
	const key = origin && store ? `${origin.id}→${store.id}` : undefined;
	const [result, setResult] = useState<Result>();

	useEffect(() => {
		if (!key || !origin || !store) return;
		let cancelled = false;
		const settle = (route: Route) => !cancelled && setResult({ key, route });
		mapData
			.getDirections(origin.target, store.location)
			.then(directions => {
				if (!directions) return settle({ status: 'unavailable' });
				const steps = buildSteps({
					instructions: toRawInstructions(directions),
					originName: origin.label,
					originHint: origin.hint,
					destinationName: store.name,
					destinationPoint: toLatLon(store.space.center),
					destinationOutline: outlineOf(store.space),
					landmarks,
					floorNames,
				});
				settle({ status: 'ready', directions, steps, distance: directions.distance });
			})
			.catch(() => settle({ status: 'unavailable' }));
		return () => {
			cancelled = true;
		};
	}, [key, mapData, origin, store, landmarks, floorNames]);

	if (!key) return { status: 'idle' };
	return result?.key === key ? result.route : { status: 'loading' };
}
