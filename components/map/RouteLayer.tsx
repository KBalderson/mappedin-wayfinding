'use client';

import { useEffect, useMemo } from 'react';
import { Navigation, useMap } from '@mappedin/react-sdk';
import type { TNavigationOptions } from '@mappedin/mappedin-js';
import type { Route } from '@/lib/useRoute';
import type { MapInsets } from './MapScene';
import { mapColors } from './theme';

type Props = {
	route: Route;
	navigating: boolean;
	activeStep: number;
	/** Panel insets; the camera re-frames when they change so the route stays visible. */
	insets: MapInsets;
};

/**
 * Draws the route and, while navigating, highlights the stretch of path for the
 * current step and frames it with the camera (switching floors when needed).
 */
export function RouteLayer({ route, navigating, activeStep, insets }: Props) {
	const { mapView } = useMap();

	const options = useMemo<TNavigationOptions>(
		() => ({
			setMapToDeparture: true,
			pathOptions: {
				color: mapColors.route,
				accentColor: mapColors.routeAccent,
				displayArrowsOnPath: true,
				animateArrowsOnPath: true,
			},
			markerOptions: { departureColor: mapColors.departure, destinationColor: mapColors.arrival },
			// The "You are here" marker stands in for the departure pin.
			createMarkers: { departure: false, destination: true, connection: true },
		}),
		[],
	);

	// Route preview: show the whole first-floor stretch of the trip.
	useEffect(() => {
		if (route.status !== 'ready' || navigating) return;
		const first = route.directions.coordinates[0];
		const sameFloor = route.directions.coordinates.filter(c => c.floorId === first.floorId);
		if (first.floorId) mapView.setFloor(first.floorId);
		mapView.Camera.focusOn(sameFloor, { duration: 800 }).catch(() => {});
	}, [mapView, route, navigating, insets]);

	// Turn-by-turn: highlight and frame the active step.
	useEffect(() => {
		if (route.status !== 'ready' || !navigating) return;
		const step = route.steps[activeStep];
		if (!step) return;
		const coords = route.directions.instructions.map(i => i.coordinate);
		// The first step previews the opening stretch up to the next action.
		const fromIndex = activeStep === 0 ? 0 : step.fromIndex;
		const toIndex = activeStep === 0 ? (route.steps[1]?.instructionIndex ?? 0) : step.instructionIndex;
		const from = coords[fromIndex];
		const to = coords[toIndex];

		if (mapView.currentFloor.id !== step.floorId) mapView.setFloor(step.floorId);

		const crossesFloors = from.floorId !== to.floorId;
		if (!crossesFloors && fromIndex !== toIndex) {
			mapView.Navigation.highlightPathSection(from, to, {
				color: mapColors.activeSection,
				widthMultiplier: 1.6,
				animationDuration: 600,
			});
		} else {
			mapView.Navigation.clearHighlightedPathSection();
		}
		const focus = crossesFloors ? [to] : [from, to];
		// Keep the store named in the instruction on screen so the visitor can match it up.
		const { landmark } = step;
		if (landmark && landmark.floorId === step.floorId) {
			focus.push(mapView.createCoordinate({ latitude: landmark.lat, longitude: landmark.lon, floorId: landmark.floorId }));
		}
		mapView.Camera.focusOn(focus, { duration: 700, maxZoomLevel: 19 }).catch(() => {});
	}, [mapView, route, navigating, activeStep, insets]);

	useEffect(() => {
		if (!navigating) mapView.Navigation.clearHighlightedPathSection();
	}, [mapView, navigating]);

	return route.status === 'ready' ? <Navigation directions={route.directions} options={options} /> : null;
}
