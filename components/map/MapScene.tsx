'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMap, useMapViewEvent } from '@mappedin/react-sdk';
import type { ParkingOrigin, Store } from '@/lib/mall';
import type { Route } from '@/lib/useRoute';
import type { Phase } from '@/lib/useWayfinding';
import { DestinationHighlight } from './DestinationHighlight';
import { FloorSwitcher } from './FloorSwitcher';
import { RouteLayer } from './RouteLayer';
import { YouAreHere, type PositionSource } from './YouAreHere';

export type MapInsets = { top: number; right: number; bottom: number; left: number };

type Props = {
	phase: Phase;
	origin?: ParkingOrigin;
	store?: Store;
	route: Route;
	activeStep: number;
	insets: MapInsets;
	onSelectStore: (storeId: string) => void;
};

export function MapScene({ phase, origin, store, route, activeStep, insets, onSelectStore }: Props) {
	const { mapView } = useMap();
	const navigating = phase === 'navigating';
	const showRoute = phase === 'preview' || navigating;

	// Labels, icons and interactive storefronts come from the venue's own data.
	const autoDone = useRef(false);
	useEffect(() => {
		if (autoDone.current) return;
		autoDone.current = true;
		mapView.auto().catch(() => {});
	}, [mapView]);

	// Dev-only handle for poking at the map from the browser console.
	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') Object.assign(window, { __mapView: mapView });
	}, [mapView]);

	// Keep the focused area clear of the bottom sheet / side panel. A layout effect so the
	// offsets are in place before child effects (e.g. RouteLayer) call focusOn in the same commit.
	useLayoutEffect(() => {
		mapView.Camera.setScreenOffsets(insets);
	}, [mapView, insets]);

	// Before a route exists, show the whole mall, then orient around the chosen parking entrance.
	// Re-runs when the panel resizes so the framing stays clear of it.
	useEffect(() => {
		if (showRoute) return;
		if (!origin) {
			mapView.Camera.focusOn(mapView.currentFloor, { duration: 600 }).catch(() => {});
			return;
		}
		if (mapView.currentFloor.id !== origin.floorId) mapView.setFloor(origin.floorId);
		// Frame the parking spot together with the building so the visitor sees how they relate.
		mapView.Camera.focusOn([origin.coordinate, mapView.currentFloor], { duration: 800 }).catch(() => {});
	}, [mapView, origin, showRoute, insets]);

	useMapViewEvent('click', event => {
		if (navigating) return;
		for (const space of event.spaces ?? []) {
			const tenant = space.enterpriseLocations.find(l => l.type === 'tenant' && !l.hidden);
			if (tenant) {
				onSelectStore(tenant.id);
				return;
			}
		}
	});

	let position: PositionSource | undefined;
	if (navigating && route.status === 'ready') {
		const step = route.steps[activeStep];
		const coords = route.directions.instructions.map(i => i.coordinate);
		const start = coords[step.fromIndex];
		// After a floor change, place the visitor where they step off rather than on the floor they left.
		position = { kind: 'step', coordinate: start.floorId === step.floorId ? start : coords[step.instructionIndex] };
	} else if (origin) {
		position = { kind: 'step', coordinate: origin.coordinate };
	}

	return (
		<>
			<DestinationHighlight space={store?.space} />
			{showRoute && <RouteLayer route={route} navigating={navigating} activeStep={activeStep} insets={insets} />}
			{position && <YouAreHere position={position} />}
			<FloorSwitcher />
		</>
	);
}
