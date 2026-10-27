import type { Store } from '@/lib/mall';
import { StoreIcon } from './icons';

export function StoreLogo({ store, size = 44 }: { store: Store; size?: number }) {
	return (
		<span
			className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white"
			style={{ width: size, height: size }}
		>
			{store.logo ? (
				// Venue logos are remote SVGs of arbitrary aspect; a plain img keeps them crisp.
				// eslint-disable-next-line @next/next/no-img-element
				<img src={store.logo} alt="" className="size-full object-contain p-1.5" loading="lazy" />
			) : (
				<StoreIcon className="text-muted" />
			)}
		</span>
	);
}

export function FloorBadge({ name, isMain }: { name: string; isMain: boolean }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${isMain ? 'bg-chip text-muted' : 'bg-amber-100 text-amber-900'}`}
		>
			{name}
		</span>
	);
}

type RowProps = { store: Store; mainFloorId: string; onChoose: (id: string) => void };

export function StoreRow({ store, mainFloorId, onChoose }: RowProps) {
	return (
		<button
			type="button"
			onClick={() => onChoose(store.id)}
			className="tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-chip"
		>
			<StoreLogo store={store} />
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium text-ink">{store.name}</span>
				<span className="block truncate text-sm text-muted">{store.categories[0] ?? 'Store'}</span>
			</span>
			<FloorBadge name={store.floorName} isMain={store.floorId === mainFloorId} />
		</button>
	);
}
