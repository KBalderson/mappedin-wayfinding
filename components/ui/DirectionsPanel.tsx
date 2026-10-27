'use client';

import { useRef, useState } from 'react';
import type { Step } from '@/lib/instructions';
import { ChevronLeft, ChevronRight, CloseIcon, ListIcon, StepIcon } from './icons';

type Props = {
	steps: Step[];
	activeStep: number;
	destinationName: string;
	onGoToStep: (index: number) => void;
	onEnd: () => void;
};

const SWIPE_THRESHOLD_PX = 50;

export function DirectionsPanel({ steps, activeStep, destinationName, onGoToStep, onEnd }: Props) {
	const [showAll, setShowAll] = useState(false);
	const touchStartX = useRef<number | null>(null);
	const step = steps[activeStep];
	const isFirst = activeStep === 0;
	const isLast = activeStep === steps.length - 1;

	const go = (index: number) => onGoToStep(Math.min(steps.length - 1, Math.max(0, index)));

	return (
		<section className="flex min-h-0 flex-col gap-3" aria-label={`Directions to ${destinationName}`}>
			<header className="flex items-center justify-between">
				<p className="text-sm font-medium text-muted">
					Step {activeStep + 1} of {steps.length}
				</p>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setShowAll(v => !v)}
						aria-expanded={showAll}
						className="tap flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand hover:bg-chip"
					>
						<ListIcon className="size-4" />
						{showAll ? 'Hide steps' : 'All steps'}
					</button>
					<button type="button" onClick={onEnd} aria-label="End directions" className="tap grid size-10 place-items-center rounded-full hover:bg-chip">
						<CloseIcon className="size-5" />
					</button>
				</div>
			</header>

			<div
				className="flex items-center gap-4 rounded-2xl bg-brand p-4 text-white shadow-sm"
				onTouchStart={e => (touchStartX.current = e.touches[0].clientX)}
				onTouchEnd={e => {
					if (touchStartX.current === null) return;
					const dx = e.changedTouches[0].clientX - touchStartX.current;
					touchStartX.current = null;
					if (Math.abs(dx) > SWIPE_THRESHOLD_PX) go(activeStep + (dx < 0 ? 1 : -1));
				}}
			>
				<span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/15">
					<StepIcon kind={step.icon} className="size-8" />
				</span>
				<div className="min-w-0" aria-live="polite" aria-atomic="true">
					{step.lead && <p className="text-sm text-white/80">{step.lead}</p>}
					<p className="text-lg leading-snug font-semibold">{step.text}</p>
				</div>
			</div>

			{showAll && (
				<ol className="max-h-[32dvh] overflow-y-auto overscroll-contain rounded-xl border border-line md:max-h-none">
					{steps.map((s, i) => (
						<li key={i}>
							<button
								type="button"
								onClick={() => go(i)}
								aria-current={i === activeStep ? 'step' : undefined}
								className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-chip ${i === activeStep ? 'bg-brand-soft' : ''} ${i < activeStep ? 'text-muted' : 'text-ink'}`}
							>
								<StepIcon kind={s.icon} className="size-5 shrink-0 text-brand" />
								<span className="min-w-0 flex-1">
									{s.text}
									{s.lead && <span className="block text-xs text-muted">{s.lead}</span>}
								</span>
							</button>
						</li>
					))}
				</ol>
			)}

			<div className="grid grid-cols-[auto_1fr] gap-2">
				<button
					type="button"
					onClick={() => go(activeStep - 1)}
					disabled={isFirst}
					aria-label="Previous step"
					className="tap grid h-13 w-13 place-items-center rounded-2xl border border-line bg-surface text-ink disabled:opacity-40"
				>
					<ChevronLeft />
				</button>
				{isLast ? (
					<button type="button" onClick={onEnd} className="tap h-13 rounded-2xl bg-ink text-base font-semibold text-white">
						I&apos;ve arrived · Done
					</button>
				) : (
					<button
						type="button"
						onClick={() => go(activeStep + 1)}
						className="tap flex h-13 items-center justify-center gap-1 rounded-2xl bg-brand text-base font-semibold text-white hover:bg-brand-strong"
					>
						Next step <ChevronRight className="size-5" />
					</button>
				)}
			</div>
		</section>
	);
}
