'use client';

import { AnimatedMarker } from '@mappedin/react-sdk';
import type { Coordinate } from '@mappedin/mappedin-js';

/**
 * Where the visitor is assumed to be. Without indoor positioning this follows the
 * parking entrance they picked and then the start of each step as they advance.
 * A live source (beacons, QR check-ins) could feed the same coordinate later.
 */
export type PositionSource = { kind: 'step'; coordinate: Coordinate };

export function YouAreHere({ position }: { position: PositionSource }) {
	return (
		<AnimatedMarker
			target={position.coordinate}
			duration={600}
			options={{ rank: 'always-visible', zIndex: 10, placement: 'center' }}
		>
			<div className="you-are-here" aria-label="You are here">
				<span className="you-are-here__pulse" />
				<span className="you-are-here__dot" />
				<span className="you-are-here__label">You are here</span>
			</div>
		</AnimatedMarker>
	);
}
