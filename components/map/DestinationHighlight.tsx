'use client';

import { useEffect } from 'react';
import { useMap } from '@mappedin/react-sdk';
import type { Space } from '@mappedin/mappedin-js';
import { mapColors } from './theme';

/** Tints the chosen storefront so it stands out from the surrounding units. */
export function DestinationHighlight({ space }: { space?: Space }) {
	const { mapView } = useMap();

	useEffect(() => {
		if (!space) return;
		const previous = mapView.getState(space)?.color;
		mapView.updateState(space, { color: mapColors.destination });
		return () => {
			if (previous) mapView.updateState(space, { color: previous });
		};
	}, [mapView, space]);

	return null;
}
