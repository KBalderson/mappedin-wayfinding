/**
 * Turns Mappedin's raw direction instructions into steps a first-time visitor can
 * follow: plain-language actions anchored to nearby stores, with walking distances.
 *
 * Kept free of SDK imports so it can be unit-tested with plain objects.
 */

export type LatLon = { lat: number; lon: number };

export type RawInstruction = {
	type: 'Departure' | 'Turn' | 'TakeConnection' | 'ExitConnection' | 'Arrival';
	bearing?: 'Straight' | 'Right' | 'SlightRight' | 'Left' | 'SlightLeft' | 'Back';
	connectionType?: string;
	direction?: 'up' | 'down' | 'none';
	/** Floor name the connection leads to (only reliable on TakeConnection). */
	toFloorName?: string;
	/** Walking distance in meters from the previous instruction to this one. */
	distance: number;
	point: LatLon;
	floorId: string;
	/** Compass heading (degrees) walking into and out of this point, measured along the path. */
	headingIn?: number;
	headingOut?: number;
};

export type PathPoint = LatLon & { floorId: string };

export type Landmark = LatLon & {
	/** How the place is spoken in a sentence, e.g. "Zara" or "the ATM". */
	name: string;
	floorId: string;
	/** Storefront outline; distances are measured to its edge rather than its center. */
	outline?: LatLon[];
	/** A freestanding feature (e.g. an information desk) visible from across a court. */
	prominent?: boolean;
};

export type StepIcon =
	| 'start'
	| 'straight'
	| 'slight-right'
	| 'right'
	| 'slight-left'
	| 'left'
	| 'back'
	| 'up'
	| 'down'
	| 'exit'
	| 'arrive';

export type Step = {
	icon: StepIcon;
	/** The action, e.g. "Turn right at Zara". */
	text: string;
	/** What to do before the action, e.g. "In 85 m". Empty for the first step. */
	lead: string;
	/** Index of the raw instruction where this step ends (its action point). */
	instructionIndex: number;
	/** Index of the raw instruction where the walk for this step starts. */
	fromIndex: number;
	floorId: string;
	/** The place the step is anchored to, so the map can keep it in view. */
	landmark?: Landmark;
};

export type BuildStepsInput = {
	instructions: RawInstruction[];
	originName: string;
	/** Fallback direction for the first step when no landmark is near, e.g. "walk toward the mall". */
	originHint?: string;
	destinationName: string;
	/** Center of the destination storefront, used to say which side it's on. */
	destinationPoint?: LatLon;
	/** Destination outline; if the route ends inside it, the store is simply "ahead". */
	destinationOutline?: LatLon[];
	landmarks: Landmark[];
	floorNames: Record<string, string>;
};

const LANDMARK_RADIUS_M = 10;
/** Prominent landmarks can anchor "continue straight past ..." from further away. */
const PROMINENT_RADIUS_M = 30;
/** Turns closer together than this are spoken as one step ("..., then turn left"). */
const COMBINE_TURN_M = 10;
/** Headings are measured over this much path so small kinks in the route graph don't count. */
const HEADING_WINDOW_M = 15;
/**
 * A turn and an opposite turn within this distance that leave the heading unchanged are a sidestep.
 * Kept short: a wider jog (e.g. across a food court) is a real maneuver worth two turns.
 */
const SIDESTEP_MAX_M = 15;
const SIDESTEP_MAX_DEG = 30;
/** A "turn" that changes the walking heading by less than this is just a kink in the path. */
const KINK_MAX_DEG = 25;
const WALKING_SPEED_MPS = 1.3;

export function distanceMeters(a: LatLon, b: LatLon): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** Meters from a point to a polygon's edge (0 when inside), in a local flat projection. */
export function distanceToOutline(point: LatLon, outline: LatLon[]): number {
	const mPerLat = 110_540;
	const mPerLon = 111_320 * Math.cos((point.lat * Math.PI) / 180);
	const xy = outline.map(p => [(p.lon - point.lon) * mPerLon, (p.lat - point.lat) * mPerLat]);
	let inside = false;
	let best = Infinity;
	for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
		const [xi, yi] = xy[i];
		const [xj, yj] = xy[j];
		if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
		const dx = xj - xi;
		const dy = yj - yi;
		const t = Math.max(0, Math.min(1, -(xi * dx + yi * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(xi + t * dx, yi + t * dy));
	}
	return inside ? 0 : best;
}

function distanceToLandmark(point: LatLon, landmark: Landmark): number {
	return landmark.outline && landmark.outline.length > 2
		? distanceToOutline(point, landmark.outline)
		: distanceMeters(point, landmark);
}

export function nearestLandmark(
	point: LatLon,
	floorId: string,
	landmarks: Landmark[],
	exclude: string[] = [],
	maxMeters = LANDMARK_RADIUS_M,
): Landmark | undefined {
	let best: Landmark | undefined;
	let bestDistance = maxMeters;
	for (const landmark of landmarks) {
		if (landmark.floorId !== floorId || exclude.includes(landmark.name)) continue;
		const d = distanceToLandmark(point, landmark);
		if (d <= bestDistance) {
			best = landmark;
			bestDistance = d;
		}
	}
	return best;
}

/** Compass bearing from a to b in degrees (0 = north, 90 = east). */
export function bearingDegrees(a: LatLon, b: LatLon): number {
	const k = Math.cos((a.lat * Math.PI) / 180);
	return ((Math.atan2((b.lon - a.lon) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

/** Signed difference between two headings, in (-180, 180]. Positive is clockwise (rightward). */
export function headingChange(from: number, to: number): number {
	const d = (((to - from) % 360) + 360) % 360;
	return d > 180 ? d - 360 : d;
}

/** Heading over the stretch of path before (step = -1) or after (step = 1) a vertex, on one floor. */
function headingAlong(path: PathPoint[], index: number, step: 1 | -1): number | undefined {
	const origin = path[index];
	let walked = 0;
	let reached: PathPoint | undefined;
	for (let i = index + step; i >= 0 && i < path.length && path[i].floorId === origin.floorId; i += step) {
		walked += distanceMeters(path[i - step], path[i]);
		reached = path[i];
		if (walked >= HEADING_WINDOW_M) break;
	}
	if (!reached || walked < 1) return undefined;
	return step === 1 ? bearingDegrees(origin, reached) : bearingDegrees(reached, origin);
}

/** Adds the walking heading into and out of each instruction, read from the route's path. */
export function withHeadings(instructions: RawInstruction[], path: PathPoint[]): RawInstruction[] {
	let cursor = 0;
	return instructions.map(ins => {
		// Instructions lie on the path in order, so search forward from the previous match.
		let best = -1;
		let bestDistance = Infinity;
		for (let i = cursor; i < path.length; i++) {
			if (path[i].floorId !== ins.floorId) continue;
			const d = distanceMeters(path[i], ins.point);
			if (d < bestDistance) {
				best = i;
				bestDistance = d;
			}
			if (d < 0.5) break;
		}
		if (best < 0) return ins;
		cursor = best;
		return { ...ins, headingIn: headingAlong(path, best, -1), headingOut: headingAlong(path, best, 1) };
	});
}

const SIDE: Partial<Record<NonNullable<RawInstruction['bearing']>, 1 | -1>> = {
	Right: 1,
	SlightRight: 1,
	Left: -1,
	SlightLeft: -1,
};

/** Right-then-left (or left-then-right) a few steps apart that ends on the same heading. */
function isSidestep(a: RawInstruction, b: RawInstruction): boolean {
	const sideA = a.bearing && SIDE[a.bearing];
	const sideB = b.bearing && SIDE[b.bearing];
	if (a.type !== 'Turn' || b.type !== 'Turn' || !sideA || !sideB || sideA === sideB) return false;
	if (b.distance > SIDESTEP_MAX_M || a.headingIn === undefined || b.headingOut === undefined) return false;
	return Math.abs(headingChange(a.headingIn, b.headingOut)) <= SIDESTEP_MAX_DEG;
}

/** The SDK calls it a full turn, but the walker's heading barely changes. */
function isKink(ins: RawInstruction): boolean {
	if (ins.type !== 'Turn' || (ins.bearing !== 'Left' && ins.bearing !== 'Right')) return false;
	if (ins.headingIn === undefined || ins.headingOut === undefined) return false;
	return Math.abs(headingChange(ins.headingIn, ins.headingOut)) < KINK_MAX_DEG;
}

export function formatDistance(meters: number): string {
	if (meters < 10) return 'a few steps';
	return `${Math.round(meters / 5) * 5} m`;
}

export function formatWalkTime(meters: number): string {
	const minutes = Math.max(1, Math.round(meters / WALKING_SPEED_MPS / 60));
	return `${minutes} min walk`;
}

/** Which side of the walker the target is on, given the direction they arrive from. */
export function sideOf(from: LatLon, at: LatLon, target: LatLon): 'left' | 'right' | 'ahead' {
	// Local equirectangular projection is plenty accurate at mall scale.
	const k = Math.cos((at.lat * Math.PI) / 180);
	const hx = (at.lon - from.lon) * k;
	const hy = at.lat - from.lat;
	const tx = (target.lon - at.lon) * k;
	const ty = target.lat - at.lat;
	const cross = hx * ty - hy * tx;
	const dot = hx * tx + hy * ty;
	const angle = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
	if (angle < 35) return 'ahead';
	return cross > 0 ? 'left' : 'right';
}

const TURN_PHRASES: Record<NonNullable<RawInstruction['bearing']>, { verb: string; icon: StepIcon; short: string }> = {
	Straight: { verb: 'Continue straight', icon: 'straight', short: 'continue straight' },
	Right: { verb: 'Turn right', icon: 'right', short: 'turn right' },
	SlightRight: { verb: 'Bear right', icon: 'slight-right', short: 'bear right' },
	Left: { verb: 'Turn left', icon: 'left', short: 'turn left' },
	SlightLeft: { verb: 'Bear left', icon: 'slight-left', short: 'bear left' },
	Back: { verb: 'Turn around', icon: 'back', short: 'turn around' },
};

function connectionName(type?: string): string {
	switch (type) {
		case 'escalator':
		case 'elevator':
		case 'stairs':
		case 'ramp':
			return `the ${type}`;
		default:
			return 'the connector';
	}
}

function lead(distance: number): string {
	return distance < 10 ? 'Right away' : `In ${formatDistance(distance)}`;
}

export function buildSteps(input: BuildStepsInput): Step[] {
	const { instructions, originName, originHint, destinationName, destinationPoint, destinationOutline, landmarks, floorNames } =
		input;
	// Don't anchor to where they started or where they're going, or repeat the last landmark used.
	let lastLandmark: string | undefined;
	const excluded = () => [originName, destinationName, lastLandmark ?? ''];
	const landmarkAt = (i: RawInstruction) => nearestLandmark(i.point, i.floorId, landmarks, excluded());
	// Something to walk past: a prominent feature nearby, otherwise the closest storefront.
	const passing = (points: RawInstruction[]) => {
		const prominent = landmarks.filter(l => l.prominent);
		const nearest = points
			.map(p => nearestLandmark(p.point, p.floorId, prominent, excluded(), PROMINENT_RADIUS_M))
			.find(Boolean);
		return nearest ?? landmarkAt(points[points.length - 1]);
	};
	// Sidesteps (a turn undone by an opposite turn a few steps later) are spoken as "continue straight".
	const sidestepEnds = new Set<number>();
	for (let i = 0; i + 1 < instructions.length; i++) {
		if (!sidestepEnds.has(i) && isSidestep(instructions[i], instructions[i + 1])) sidestepEnds.add(i + 1);
	}
	const steps: Step[] = [];
	// Distance walked through instructions that didn't become their own step.
	let carried = 0;

	instructions.forEach((ins, index) => {
		const prevStep = steps[steps.length - 1];
		const fromIndex = prevStep ? prevStep.instructionIndex : 0;
		const base = { instructionIndex: index, fromIndex, floorId: ins.floorId };
		const walked = ins.distance + carried;
		carried = 0;

		switch (ins.type) {
			case 'Departure': {
				// Look along the opening stretch (through any "straight" points) for something to aim at.
				let toward: Landmark | undefined;
				for (const next of instructions.slice(index + 1)) {
					toward = landmarkAt(next);
					if (toward || next.type !== 'Turn' || next.bearing !== 'Straight') break;
				}
				steps.push({
					...base,
					icon: 'start',
					lead: '',
					text: toward
						? `Start at ${originName} and head toward ${toward.name}`
						: `Start at ${originName}${originHint ? ` and ${originHint}` : ''}`,
					landmark: toward,
				});
				return;
			}
			case 'Turn': {
				if (sidestepEnds.has(index + 1)) {
					carried = walked;
					return;
				}
				const sidestep = sidestepEnds.has(index);
				const bearing = sidestep || isKink(ins) ? 'Straight' : (ins.bearing ?? 'Straight');
				const phrase = TURN_PHRASES[bearing];
				// Two turns a few steps apart read better as one instruction.
				if (bearing !== 'Straight' && prevStep && walked < COMBINE_TURN_M && instructions[prevStep.instructionIndex].type === 'Turn') {
					prevStep.text = `${prevStep.text}, then ${phrase.short}`;
					prevStep.instructionIndex = index;
					return;
				}
				// "Continue straight" with no landmark adds nothing; fold its distance into the next step.
				const landmark =
					bearing === 'Straight'
						? passing(sidestep ? [instructions[index - 1], ins] : [ins])
						: landmarkAt(ins);
				if (bearing === 'Straight' && !landmark) {
					carried = walked;
					return;
				}
				const anchor = bearing !== 'Back' ? landmark : undefined;
				if (anchor) lastLandmark = anchor.name;
				const preposition = bearing === 'Straight' ? 'past' : 'at';
				steps.push({
					...base,
					icon: phrase.icon,
					lead: lead(walked),
					text: anchor ? `${phrase.verb} ${preposition} ${anchor.name}` : phrase.verb,
					landmark: anchor,
				});
				return;
			}
			case 'TakeConnection': {
				const dir = ins.direction === 'down' ? 'down' : 'up';
				const floor = ins.toFloorName ? ` to ${ins.toFloorName}` : '';
				steps.push({
					...base,
					icon: dir,
					lead: lead(walked),
					text: `Take ${connectionName(ins.connectionType)} ${dir}${floor}`,
				});
				return;
			}
			case 'ExitConnection': {
				const floor = floorNames[ins.floorId] ?? 'the next floor';
				steps.push({
					...base,
					icon: 'exit',
					lead: '',
					text: `Step off on ${floor}`,
				});
				return;
			}
			case 'Arrival': {
				const prevPoint = instructions[index - 1]?.point;
				const endsInside = destinationOutline && distanceToOutline(ins.point, destinationOutline) < 1;
				const side =
					prevPoint && destinationPoint && !endsInside ? sideOf(prevPoint, ins.point, destinationPoint) : 'ahead';
				const where = side === 'ahead' ? 'is straight ahead' : `is on your ${side}`;
				steps.push({
					...base,
					icon: 'arrive',
					lead: lead(walked),
					text: `${destinationName} ${where}`,
				});
				return;
			}
		}
	});

	return steps;
}
