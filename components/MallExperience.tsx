'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView } from '@mappedin/react-sdk';
import type { MapData } from '@mappedin/mappedin-js';
import { getFloorNames, getLandmarks, getMainFloorId, getParkingOrigins, getStores } from '@/lib/mall';
import { useRoute } from '@/lib/useRoute';
import { useWayfinding } from '@/lib/useWayfinding';
import { MapScene, type MapInsets } from './map/MapScene';
import { DirectionsPanel } from './ui/DirectionsPanel';
import { ParkingPicker } from './ui/ParkingPicker';
import { RoutePreview } from './ui/RoutePreview';
import { StoreDirectory } from './ui/StoreDirectory';

const DESKTOP_QUERY = '(min-width: 768px)';
const PANEL_GAP_PX = 16;
const TOP_INSET_PX = 72;
// Breathing room so route ends and markers aren't framed against the screen edge.
const EDGE_PX = 60;

/** Measures the panel so the map camera frames routes in the visible area beside/above it. */
function usePanelInsets(panel: React.RefObject<HTMLElement | null>): MapInsets {
	const [insets, setInsets] = useState<MapInsets>({ top: TOP_INSET_PX, right: EDGE_PX, bottom: EDGE_PX, left: EDGE_PX });
	useEffect(() => {
		const el = panel.current;
		if (!el) return;
		const desktop = window.matchMedia(DESKTOP_QUERY);
		const update = () => {
			const rect = el.getBoundingClientRect();
			setInsets(
				desktop.matches
					? { top: TOP_INSET_PX, right: EDGE_PX, bottom: EDGE_PX, left: rect.right + PANEL_GAP_PX + EDGE_PX }
					: { top: TOP_INSET_PX, right: EDGE_PX, bottom: window.innerHeight - rect.top + PANEL_GAP_PX, left: EDGE_PX },
			);
		};
		const observer = new ResizeObserver(update);
		observer.observe(el);
		desktop.addEventListener('change', update);
		window.addEventListener('resize', update);
		return () => {
			observer.disconnect();
			desktop.removeEventListener('change', update);
			window.removeEventListener('resize', update);
		};
	}, [panel]);
	return insets;
}

export function MallExperience({ mapData }: { mapData: MapData }) {
	const origins = useMemo(() => getParkingOrigins(mapData), [mapData]);
	const stores = useMemo(() => getStores(mapData), [mapData]);
	const landmarks = useMemo(() => getLandmarks(mapData), [mapData]);
	const floorNames = useMemo(() => getFloorNames(mapData), [mapData]);
	const mainFloorId = useMemo(() => getMainFloorId(mapData), [mapData]);
	const venueName = mapData.getByType('enterprise-venue')?.name ?? 'Mall directory';

	const { state, chooseParking, changeParking, chooseStore, backToDirectory, start, goToStep, end } = useWayfinding(
		origins.map(o => o.id),
		stores.map(s => s.id),
	);
	const origin = origins.find(o => o.id === state.originId);
	const store = stores.find(s => s.id === state.storeId);
	const route = useRoute(mapData, origin, store, landmarks, floorNames);

	const panelRef = useRef<HTMLElement>(null);
	const insets = usePanelInsets(panelRef);
	const [collapsed, setCollapsed] = useState(false);
	const canCollapse = state.phase !== 'navigating';
	const isCollapsed = collapsed && canCollapse;

	const mapOptions = useMemo(() => ({ initialFloor: mainFloorId }), [mainFloorId]);

	return (
		<main className="relative h-dvh w-full overflow-hidden bg-canvas">
			<div className="absolute inset-0">
				<MapView mapData={mapData} options={mapOptions}>
					<MapScene
						phase={state.phase}
						origin={origin}
						store={store}
						route={route}
						activeStep={state.activeStep}
						insets={insets}
						onSelectStore={id => {
							setCollapsed(false);
							chooseStore(id);
						}}
					/>
				</MapView>
			</div>

			<div className="venue-chip">
				<span className="size-2 rounded-full bg-brand" aria-hidden="true" />
				{venueName}
			</div>

			<aside
				ref={panelRef}
				data-phase={state.phase}
				data-collapsed={isCollapsed || undefined}
				className="panel"
				aria-label="Wayfinding"
			>
				<button
					type="button"
					className="panel-handle md:hidden"
					onClick={() => canCollapse && setCollapsed(c => !c)}
					aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel to see the map'}
					aria-expanded={!isCollapsed}
				>
					<span />
				</button>

				<div className="panel-body">
					{state.phase === 'parking' && (
						<ParkingPicker origins={origins} selectedId={state.originId} onChoose={chooseParking} />
					)}
					{state.phase === 'directory' && (
						<StoreDirectory
							stores={stores}
							origin={origin}
							mainFloorId={mainFloorId}
							onChoose={chooseStore}
							onChangeParking={changeParking}
						/>
					)}
					{state.phase === 'preview' && store && origin && (
						<RoutePreview
							store={store}
							origin={origin}
							route={route}
							mainFloorId={mainFloorId}
							onStart={start}
							onBack={backToDirectory}
							onChangeParking={changeParking}
						/>
					)}
					{state.phase === 'navigating' && store && route.status === 'ready' && (
						<DirectionsPanel
							steps={route.steps}
							activeStep={state.activeStep}
							destinationName={store.name}
							onGoToStep={goToStep}
							onEnd={end}
						/>
					)}
				</div>
			</aside>
		</main>
	);
}
