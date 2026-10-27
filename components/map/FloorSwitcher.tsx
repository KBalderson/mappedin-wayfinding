'use client';

import { useEffect, useState } from 'react';
import { useMap } from '@mappedin/react-sdk';
import type { TEventPayload } from '@mappedin/mappedin-js';

export function FloorSwitcher() {
	const { mapView, mapData } = useMap();
	const floors = [...mapData.getByType('floor')].sort((a, b) => b.elevation - a.elevation);
	const [currentId, setCurrentId] = useState(() => mapView.currentFloor.id);

	// Subscribe once rather than via useMapViewEvent: that hook re-subscribes on every render,
	// and a sibling effect calling setFloor in the same commit would fire before it re-attaches.
	useEffect(() => {
		const onFloorChange = (event: TEventPayload<'floor-change'>) => setCurrentId(event.floor.id);
		mapView.on('floor-change', onFloorChange);
		return () => mapView.off('floor-change', onFloorChange);
	}, [mapView]);

	return (
		<div className="floor-switcher" role="group" aria-label="Floor">
			{floors.map(floor => (
				<button
					key={floor.id}
					type="button"
					aria-pressed={floor.id === currentId}
					onClick={() => mapView.setFloor(floor.id)}
				>
					{floor.name.replace(/ Level$/, '')}
				</button>
			))}
		</div>
	);
}
