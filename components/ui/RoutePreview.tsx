'use client';

import { formatDistance, formatWalkTime } from '@/lib/instructions';
import type { ParkingOrigin, Store } from '@/lib/mall';
import type { Route } from '@/lib/useRoute';
import { ChevronLeft, ParkingIcon, WalkIcon } from './icons';
import { FloorBadge, StoreLogo } from './StoreRow';

type Props = {
	store: Store;
	origin: ParkingOrigin;
	route: Route;
	mainFloorId: string;
	onStart: () => void;
	onBack: () => void;
	onChangeParking: () => void;
};

export function RoutePreview({ store, origin, route, mainFloorId, onStart, onBack, onChangeParking }: Props) {
	const via = route.status === 'ready' ? route.steps.find(s => s.via)?.via : undefined;

	return (
		<section className="flex flex-col gap-4" aria-labelledby="preview-heading">
			<div className="flex items-start gap-3">
				<button type="button" onClick={onBack} className="tap -ml-2 grid size-10 place-items-center rounded-full hover:bg-chip" aria-label="Back to stores">
					<ChevronLeft />
				</button>
				<StoreLogo store={store} size={52} />
				<div className="min-w-0 flex-1">
					<h2 id="preview-heading" className="truncate text-xl font-semibold text-ink">
						{store.name}
					</h2>
					<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
						<span>{store.categories[0] ?? 'Store'}</span>
						<FloorBadge name={store.floorName} isMain={store.floorId === mainFloorId} />
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 rounded-xl bg-chip px-3 py-2 text-sm">
				<ParkingIcon className="size-5 text-brand" />
				<span className="min-w-0 flex-1 truncate text-ink">
					From <strong className="font-semibold">{origin.label}</strong>
					<span className="text-muted"> · {origin.sublabel}</span>
				</span>
				<button type="button" onClick={onChangeParking} className="tap font-medium text-brand">
					Change
				</button>
			</div>

			<div aria-live="polite" className="min-h-12">
				{route.status === 'loading' && <p className="text-sm text-muted">Finding the best route…</p>}
				{route.status === 'unavailable' && (
					<p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
						We couldn&apos;t find a walking route to {store.name}. Please ask at Guest Services for help.
					</p>
				)}
				{route.status === 'ready' && (
					<div className="flex items-center gap-3">
						<WalkIcon className="text-brand" />
						<div>
							<p className="font-semibold text-ink">
								{formatWalkTime(route.distance)} · {formatDistance(route.distance)}
							</p>
							<p className="text-sm text-muted">
								{route.steps.length} steps
								{via ? ` · via ${via}` : ' · all on this level'}
							</p>
						</div>
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={onStart}
				disabled={route.status !== 'ready'}
				className="tap h-13 rounded-2xl bg-brand text-base font-semibold text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-40"
			>
				Start directions
			</button>
		</section>
	);
}
