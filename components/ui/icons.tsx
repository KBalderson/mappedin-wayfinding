import type { SVGProps } from 'react';
import type { StepIcon as StepIconKind } from '@/lib/instructions';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			width={24}
			height={24}
			{...props}
		>
			{children}
		</svg>
	);
}

export const SearchIcon = (p: IconProps) => (
	<Svg {...p}>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</Svg>
);

export const ChevronRight = (p: IconProps) => (
	<Svg {...p}>
		<path d="m9 6 6 6-6 6" />
	</Svg>
);

export const ChevronLeft = (p: IconProps) => (
	<Svg {...p}>
		<path d="m15 6-6 6 6 6" />
	</Svg>
);

export const CloseIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M18 6 6 18M6 6l12 12" />
	</Svg>
);

export const ListIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
	</Svg>
);

export const ParkingIcon = (p: IconProps) => (
	<Svg {...p}>
		<rect x="3" y="3" width="18" height="18" rx="4" />
		<path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
	</Svg>
);

export const StoreIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M4 10v10h16V10M3 4h18l-1 6H4L3 4Z" />
		<path d="M10 20v-5h4v5" />
	</Svg>
);

export const WalkIcon = (p: IconProps) => (
	<Svg {...p}>
		<circle cx="13" cy="4" r="2" />
		<path d="m9 20 3-6 3 3v4M10 9l3-1 3 4 3 1M10 9l-2 5" />
	</Svg>
);

/** The Vasa mark: an outrigger canoe under a crab-claw sail. Mirrors `app/icon.svg`. */
export const VasaLogo = (p: IconProps) => (
	<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" width={24} height={24} {...p}>
		<path d="M14.5 16.5Q8.5 11 7 3q6 4.5 14.5 1.5-5 5.5-7 12Z" />
		<path d="M14.5 16v3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
		<path d="M1.5 16.5Q3 18.5 6 19h20q3-.5 4.5-2.5-1.5 6-6.5 6H8q-5 0-6.5-6Z" />
		<path d="M9 21q0 4.5-2.5 5.6M23 21q0 4.5 2.5 5.6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
		<path d="M3 27q13-2.25 26 0-13 2.25-26 0Z" />
	</svg>
);

/** Rotations for a single "up" arrow; one glyph keeps every turn visually consistent. */
const ARROW_ROTATION: Partial<Record<StepIconKind, number>> = {
	straight: 0,
	'slight-right': 45,
	right: 90,
	back: 180,
	left: -90,
	'slight-left': -45,
};

export function StepIcon({ kind, ...p }: IconProps & { kind: StepIconKind }) {
	const rotation = ARROW_ROTATION[kind];
	if (rotation !== undefined) {
		return (
			<Svg {...p} style={{ transform: `rotate(${rotation}deg)` }}>
				<path d="M12 20V5M6 11l6-6 6 6" />
			</Svg>
		);
	}
	switch (kind) {
		case 'start':
			return <ParkingIcon {...p} />;
		case 'up':
		case 'down':
			return (
				<Svg {...p}>
					<rect x="4" y="3" width="16" height="18" rx="2" />
					<path d={kind === 'up' ? 'm8 13 4-4 4 4' : 'm8 11 4 4 4-4'} />
				</Svg>
			);
		case 'exit':
			return <WalkIcon {...p} />;
		case 'arrive':
		default:
			return (
				<Svg {...p}>
					<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
					<circle cx="12" cy="10" r="2.5" />
				</Svg>
			);
	}
}
