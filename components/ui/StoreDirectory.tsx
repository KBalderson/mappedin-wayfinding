'use client';

import { useMemo, useState } from 'react';
import { searchStores, type ParkingOrigin, type Store } from '@/lib/mall';
import { readRecentStoreIds } from '@/lib/useWayfinding';
import { ParkingIcon, SearchIcon } from './icons';
import { StoreRow } from './StoreRow';

type Props = {
	stores: Store[];
	origin?: ParkingOrigin;
	mainFloorId: string;
	onChoose: (storeId: string) => void;
	onChangeParking: () => void;
};

const MAX_CHIPS = 10;

export function StoreDirectory({ stores, origin, mainFloorId, onChoose, onChangeParking }: Props) {
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<string>();
	const [recentIds] = useState(readRecentStoreIds);

	const categories = useMemo(() => {
		const counts = new Map<string, number>();
		for (const store of stores) for (const c of store.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, MAX_CHIPS)
			.map(([name]) => name);
	}, [stores]);

	const results = useMemo(() => searchStores(stores, query, category), [stores, query, category]);
	const recents = useMemo(
		() => recentIds.map(id => stores.find(s => s.id === id)).filter((s): s is Store => !!s),
		[recentIds, stores],
	);
	const showRecents = !query && !category && recents.length > 0;

	return (
		<section className="flex min-h-0 flex-1 flex-col" aria-labelledby="directory-heading">
			{origin && (
				<div className="mb-3 flex items-center gap-2 rounded-xl bg-chip px-3 py-2 text-sm">
					<ParkingIcon className="size-5 text-brand" />
					<span className="min-w-0 flex-1 truncate text-ink">
						From <strong className="font-semibold">{origin.label}</strong>
						<span className="text-muted"> · {origin.sublabel}</span>
					</span>
					<button type="button" onClick={onChangeParking} className="tap font-medium text-brand">
						Change
					</button>
				</div>
			)}

			<h2 id="directory-heading" className="text-xl font-semibold text-ink">
				Where to?
			</h2>

			<label className="relative mt-3 block">
				<span className="sr-only">Search stores</span>
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
				<input
					type="search"
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Search stores or categories"
					autoComplete="off"
					enterKeyHint="search"
					className="h-12 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-base text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
				/>
			</label>

			<div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categories">
				{categories.map(name => (
					<button
						key={name}
						type="button"
						aria-pressed={category === name}
						onClick={() => setCategory(c => (c === name ? undefined : name))}
						className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink transition aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
					>
						{name}
					</button>
				))}
			</div>

			<div className="-mx-2 mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-2">
				{showRecents && (
					<>
						<h3 className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Recent</h3>
						<ul>
							{recents.map(store => (
								<li key={store.id}>
									<StoreRow store={store} mainFloorId={mainFloorId} onChoose={onChoose} />
								</li>
							))}
						</ul>
					</>
				)}
				<h3 className="px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase" aria-live="polite">
					{query || category ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'All stores'}
				</h3>
				{results.length === 0 ? (
					<p className="px-2 py-6 text-center text-sm text-muted">
						{query ? (
							<>
								No stores match &ldquo;{query}&rdquo;{category ? ` in ${category}` : ''}. Try a brand name or a
								category like &ldquo;shoes&rdquo;.
							</>
						) : (
							'No stores in this category.'
						)}
					</p>
				) : (
					<ul>
						{results.map(store => (
							<li key={store.id}>
								<StoreRow store={store} mainFloorId={mainFloorId} onChoose={onChoose} />
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
