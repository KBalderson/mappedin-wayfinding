'use client';

import type { ParkingOrigin } from '@/lib/mall';
import { ChevronRight, ParkingIcon } from './icons';

type Props = {
	origins: ParkingOrigin[];
	selectedId?: string;
	onChoose: (originId: string) => void;
};

export function ParkingPicker({ origins, selectedId, onChoose }: Props) {
	return (
		<section className="flex flex-col gap-4" aria-labelledby="parking-heading">
			<header>
				<h2 id="parking-heading" className="text-xl font-semibold text-ink">
					Where did you park?
				</h2>
				<p className="mt-1 text-sm text-muted">We&apos;ll start your directions from that entrance.</p>
			</header>
			<ul className="flex flex-col gap-2">
				{origins.map(origin => (
					<li key={origin.id}>
						<button
							type="button"
							onClick={() => onChoose(origin.id)}
							aria-current={origin.id === selectedId ? 'true' : undefined}
							className="tap flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-brand aria-[current]:border-brand aria-[current]:bg-brand-soft"
						>
							<span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
								<ParkingIcon />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-medium text-ink">{origin.label}</span>
								<span className="block text-sm text-muted">{origin.sublabel}</span>
							</span>
							<ChevronRight className="text-muted" />
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}
