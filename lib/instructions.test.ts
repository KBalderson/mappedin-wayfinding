import { describe, expect, it } from 'vitest';
import {
	buildSteps,
	distanceMeters,
	formatDistance,
	formatWalkTime,
	nearestLandmark,
	sideOf,
	withHeadings,
	type Landmark,
	type RawInstruction,
} from './instructions';

const L0 = 'lower';
const L1 = 'upper';
const floorNames = { [L0]: 'Lower Level', [L1]: 'Upper Level' };

// ~1 m of latitude, so offsets read as meters north of the origin.
const M = 1 / 111_320;
const at = (north: number, east = 0) => ({ lat: 43.86 + north * M, lon: -78.95 + (east * M) / Math.cos((43.86 * Math.PI) / 180) });

function ins(partial: Partial<RawInstruction> & Pick<RawInstruction, 'type'>): RawInstruction {
	return { distance: 0, point: at(0), floorId: L0, ...partial };
}

const landmarks: Landmark[] = [
	{ name: 'Zara', floorId: L0, ...at(85, 3) },
	{ name: 'Sephora', floorId: L1, ...at(85, 3) },
	{ name: 'Parking Garage I', floorId: L0, ...at(0, 2) },
];

describe('distance helpers', () => {
	it('measures meters between points', () => {
		expect(distanceMeters(at(0), at(100))).toBeCloseTo(100, 0);
	});

	it('formats short and rounded distances', () => {
		expect(formatDistance(4)).toBe('a few steps');
		expect(formatDistance(83)).toBe('85 m');
		expect(formatWalkTime(20)).toBe('1 min walk');
		expect(formatWalkTime(390)).toBe('5 min walk');
	});
});

describe('nearestLandmark', () => {
	it('picks the closest landmark on the same floor within range', () => {
		expect(nearestLandmark(at(85), L0, landmarks)?.name).toBe('Zara');
		expect(nearestLandmark(at(85), L1, landmarks)?.name).toBe('Sephora');
	});

	it('ignores far-away and excluded landmarks', () => {
		expect(nearestLandmark(at(40), L0, landmarks)).toBeUndefined();
		expect(nearestLandmark(at(85), L0, landmarks, ['Zara'])).toBeUndefined();
	});
});

describe('distanceToOutline', () => {
	// A 20 m × 20 m store whose front wall is 2 m east of the corridor point.
	const store = [at(-10, 2), at(10, 2), at(10, 22), at(-10, 22), at(-10, 2)];

	it('measures to the nearest wall, not the center', () => {
		expect(distanceMeters(at(0), at(0, 12))).toBeGreaterThan(11);
		expect(nearestLandmark(at(0), L0, [{ name: 'Big Box', floorId: L0, ...at(0, 12), outline: store }])?.name).toBe(
			'Big Box',
		);
	});

	it('is zero inside the outline', () => {
		expect(nearestLandmark(at(0, 5), L0, [{ name: 'Big Box', floorId: L0, ...at(0, 12), outline: store }])?.name).toBe(
			'Big Box',
		);
	});
});

describe('sideOf', () => {
	it('reports left, right and ahead relative to the walking direction', () => {
		// Walking north.
		expect(sideOf(at(0), at(10), at(12, -5))).toBe('left');
		expect(sideOf(at(0), at(10), at(12, 5))).toBe('right');
		expect(sideOf(at(0), at(10), at(20, 0.5))).toBe('ahead');
	});
});

describe('buildSteps', () => {
	const base = { originName: 'Parking Garage I', destinationName: 'Gap', landmarks, floorNames };

	it('anchors departure and turns to nearby stores', () => {
		const steps = buildSteps({
			...base,
			instructions: [
				ins({ type: 'Departure' }),
				ins({ type: 'Turn', bearing: 'Right', distance: 85, point: at(85) }),
				ins({ type: 'Arrival', distance: 30, point: at(85, 30) }),
			],
		});
		expect(steps.map(s => s.text)).toEqual([
			'Start at Parking Garage I and head toward Zara',
			'Turn right at Zara',
			'Gap is straight ahead',
		]);
		expect(steps[1].lead).toBe('In 85 m');
		expect(steps[1].icon).toBe('right');
	});

	it('does not anchor two steps in a row to the same landmark', () => {
		const steps = buildSteps({
			...base,
			instructions: [
				ins({ type: 'Departure' }),
				ins({ type: 'Turn', bearing: 'Left', distance: 85, point: at(85) }),
				ins({ type: 'Turn', bearing: 'Right', distance: 4, point: at(88) }),
				ins({ type: 'Turn', bearing: 'SlightLeft', distance: 20, point: at(84, 4) }),
			],
		});
		expect(steps.map(s => s.text)).toEqual([
			'Start at Parking Garage I and head toward Zara',
			'Turn left at Zara, then turn right',
			'Bear left',
		]);
	});

	it('omits the landmark clause when nothing is close', () => {
		const steps = buildSteps({
			...base,
			instructions: [ins({ type: 'Departure' }), ins({ type: 'Turn', bearing: 'SlightLeft', distance: 40, point: at(40) })],
		});
		expect(steps[0].text).toBe('Start at Parking Garage I');
		expect(steps[1].text).toBe('Bear left');
	});

	it('falls back to the origin hint when no landmark is near the start', () => {
		const steps = buildSteps({
			...base,
			originHint: 'walk toward the mall',
			instructions: [ins({ type: 'Departure' }), ins({ type: 'Turn', bearing: 'Left', distance: 40, point: at(40) })],
		});
		expect(steps[0].text).toBe('Start at Parking Garage I and walk toward the mall');
	});

	it('merges turns a few steps apart into one step', () => {
		const steps = buildSteps({
			...base,
			instructions: [
				ins({ type: 'Departure' }),
				ins({ type: 'Turn', bearing: 'Right', distance: 85, point: at(85) }),
				ins({ type: 'Turn', bearing: 'Left', distance: 6, point: at(85, 6) }),
			],
		});
		expect(steps).toHaveLength(2);
		expect(steps[1].text).toBe('Turn right at Zara, then turn left');
		expect(steps[1].instructionIndex).toBe(2);
	});

	it('folds landmark-less "continue straight" into the next step distance', () => {
		const steps = buildSteps({
			...base,
			instructions: [
				ins({ type: 'Departure' }),
				ins({ type: 'Turn', bearing: 'Straight', distance: 30, point: at(30) }),
				ins({ type: 'Turn', bearing: 'Left', distance: 55, point: at(85) }),
			],
		});
		expect(steps.map(s => s.text)).toEqual(['Start at Parking Garage I and head toward Zara', 'Turn left at Zara']);
		expect(steps[1].lead).toBe('In 85 m');
		expect(steps[1].fromIndex).toBe(0);
	});

	it('describes floor changes using the destination floor name', () => {
		const steps = buildSteps({
			...base,
			instructions: [
				ins({ type: 'Departure' }),
				ins({ type: 'TakeConnection', connectionType: 'escalator', direction: 'up', toFloorName: 'Upper Level', distance: 40, point: at(40) }),
				// The SDK reports the wrong toFloor on exit, so the step uses the exit point's floor.
				ins({ type: 'ExitConnection', connectionType: 'escalator', direction: 'down', toFloorName: 'Lower Level', distance: 9, point: at(49), floorId: L1 }),
				ins({ type: 'Arrival', distance: 20, point: at(69), floorId: L1 }),
			],
		});
		expect(steps.map(s => s.text)).toEqual([
			'Start at Parking Garage I',
			'Take the escalator up to Upper Level',
			'Step off on Upper Level',
			'Gap is straight ahead',
		]);
		expect(steps[1].icon).toBe('up');
	});

	it('says which side the destination is on', () => {
		const steps = buildSteps({
			...base,
			destinationPoint: at(50, 8),
			instructions: [ins({ type: 'Departure' }), ins({ type: 'Arrival', distance: 50, point: at(50) })],
		});
		expect(steps[1].text).toBe('Gap is on your right');
		expect(steps[1].lead).toBe('In 50 m');
	});

	it('says "ahead" when the route ends inside the store', () => {
		const steps = buildSteps({
			...base,
			destinationPoint: at(50, 8),
			destinationOutline: [at(45, 2), at(55, 2), at(55, 14), at(45, 14), at(45, 2)],
			instructions: [ins({ type: 'Departure' }), ins({ type: 'Arrival', distance: 50, point: at(50, 4) })],
		});
		expect(steps[1].text).toBe('Gap is straight ahead');
	});
});

describe('sidesteps', () => {
	// Walk north, jog 8 m east where the corridor opens into a court, then carry on north.
	const path = [at(0), at(20), at(40), at(60), at(80), at(80, 8), at(100, 8), at(120, 8), at(160, 8)].map(p => ({
		...p,
		floorId: L0,
	}));
	const court: Landmark[] = [
		{ name: 'Toxik', floorId: L0, ...at(82, -3) },
		{ name: 'the Information Desk', floorId: L0, prominent: true, ...at(95, 30) },
	];
	const base = { originName: 'Parking Garage I', destinationName: 'Gap', landmarks: court, floorNames };

	it('reads walking headings from the path, smoothing over short kinks', () => {
		const [turn, jog] = withHeadings(
			[
				ins({ type: 'Turn', bearing: 'Right', distance: 80, point: at(80) }),
				ins({ type: 'Turn', bearing: 'Left', distance: 8, point: at(80, 8) }),
			],
			path,
		);
		// Heading in before the jog and out after it are both due north.
		expect(turn.headingIn).toBeCloseTo(0, 0);
		expect(jog.headingOut).toBeCloseTo(0, 0);
		// The 8 m jog sits inside the 15 m window, so it only nudges the heading out of the first turn.
		expect(turn.headingOut).toBeLessThan(45);
	});

	it('speaks a right-then-left jog as continuing straight past a prominent landmark', () => {
		const steps = buildSteps({
			...base,
			instructions: withHeadings(
				[
					ins({ type: 'Departure' }),
					ins({ type: 'Turn', bearing: 'Right', distance: 80, point: at(80) }),
					ins({ type: 'Turn', bearing: 'Left', distance: 8, point: at(80, 8) }),
					ins({ type: 'Arrival', distance: 80, point: at(160, 8) }),
				],
				path,
			),
		});
		expect(steps.map(s => s.text)).toEqual([
			'Start at Parking Garage I and head toward Toxik',
			'Continue straight past the Information Desk',
			'Gap is straight ahead',
		]);
		expect(steps[1].lead).toBe('In 90 m');
		expect(steps[1].icon).toBe('straight');
	});

	it('speaks a "turn" that barely changes direction as continuing straight', () => {
		// The SDK says "Left" for a 3 m kink; the corridor carries on north.
		const kinked = [at(0), at(40), at(78), at(80, -3), at(100, -3), at(140, -3)].map(p => ({ ...p, floorId: L0 }));
		const steps = buildSteps({
			...base,
			landmarks: [{ name: 'The Bombay Company', floorId: L0, ...at(82, -6) }],
			instructions: withHeadings(
				[
					ins({ type: 'Departure' }),
					ins({ type: 'Turn', bearing: 'Left', distance: 80, point: at(80, -3) }),
					ins({ type: 'Turn', bearing: 'Right', distance: 60, point: at(140, -3) }),
				],
				kinked,
			),
		});
		expect(steps[1].text).toBe('Continue straight past The Bombay Company');
		expect(steps[1].icon).toBe('straight');
	});

	it('keeps both turns of a wide jog', () => {
		// Right, 25 m across a court, then left: same heading after, but a real maneuver.
		const wide = [at(0), at(40), at(80), at(80, 25), at(120, 25), at(160, 25)].map(p => ({ ...p, floorId: L0 }));
		const steps = buildSteps({
			...base,
			instructions: withHeadings(
				[
					ins({ type: 'Departure' }),
					ins({ type: 'Turn', bearing: 'Right', distance: 80, point: at(80) }),
					ins({ type: 'Turn', bearing: 'Left', distance: 25, point: at(80, 25) }),
				],
				wide,
			),
		});
		expect(steps.slice(1).map(s => s.text)).toEqual(['Turn right at Toxik', 'Turn left']);
	});

	it('keeps opposite turns that change the overall heading', () => {
		// Right into an east corridor, then bear left onto a diagonal: a real change of direction.
		const diagonal = [at(0), at(40), at(80), at(80, 20), at(100, 40), at(120, 60)].map(p => ({ ...p, floorId: L0 }));
		const steps = buildSteps({
			...base,
			instructions: withHeadings(
				[
					ins({ type: 'Departure' }),
					ins({ type: 'Turn', bearing: 'Right', distance: 80, point: at(80) }),
					ins({ type: 'Turn', bearing: 'SlightLeft', distance: 20, point: at(80, 20) }),
				],
				diagonal,
			),
		});
		expect(steps.slice(1).map(s => s.text)).toEqual(['Turn right at Toxik', 'Bear left']);
	});
});
