import type { Coordinate, Directions, EnterpriseLocation, MapData, PointOfInterest, Space } from '@mappedin/mappedin-js';
import { withHeadings, type Landmark, type LatLon, type RawInstruction } from './instructions';

export type ParkingOrigin = {
	id: string;
	label: string;
	sublabel: string;
	/** How to set off when no landmark is in sight, e.g. "walk toward the mall". */
	hint: string;
	floorId: string;
	target: PointOfInterest | Space;
	coordinate: Coordinate;
};

export type Store = {
	id: string;
	name: string;
	logo?: string;
	description?: string;
	categories: string[];
	floorId: string;
	floorName: string;
	location: EnterpriseLocation;
	space: Space;
};

const GARAGE = 'Parking Garage I';
const LOTS = [
	{ id: 'lot-a', name: 'Parking Lot A', sublabel: 'Outdoor surface lot' },
	{ id: 'lot-b', name: 'Parking Lot B', sublabel: 'Outdoor surface lot' },
];

/**
 * Misspelled names in the venue data, keyed as they appear there. A stopgap: the real fix is
 * in the customer's map data, after which an entry here simply stops matching.
 */
const NAME_FIXES: Record<string, string> = {
	Nordstorm: 'Nordstrom',
};

/** A location's name as visitors should see it, with known data typos corrected. */
export function displayName(name: string): string {
	return NAME_FIXES[name] ?? name;
}

/** Lower Level is the venue's default floor and the "main level" for this app. */
export function getMainFloorId(mapData: MapData): string {
	return [...mapData.getByType('floor')].sort((a, b) => a.elevation - b.elevation)[0].id;
}

function byName(mapData: MapData, name: string) {
	return mapData.getByType('enterprise-location').find(l => l.name === name);
}

/**
 * Parking entry points. The garage connects on both levels and is modelled as two
 * points of interest; the surface lots are spaces on the main level.
 */
export function getParkingOrigins(mapData: MapData): ParkingOrigin[] {
	const origins: ParkingOrigin[] = [];
	const mainFloorId = getMainFloorId(mapData);

	const garage = byName(mapData, GARAGE);
	const garagePoints = [...(garage?.points ?? [])].sort((a, b) => a.floor.elevation - b.floor.elevation);
	for (const point of garagePoints) {
		const isMain = point.floor.id === mainFloorId;
		origins.push({
			id: isMain ? 'garage-main' : 'garage-upper',
			label: GARAGE,
			sublabel: isMain ? 'Main level entrance' : `${point.floor.name} entrance`,
			hint: 'head into the mall',
			floorId: point.floor.id,
			target: point,
			coordinate: point.coordinate,
		});
	}

	for (const lot of LOTS) {
		const space = byName(mapData, lot.name)?.spaces[0];
		if (!space) continue;
		origins.push({
			id: lot.id,
			label: lot.name,
			sublabel: lot.sublabel,
			hint: 'walk toward the mall',
			floorId: space.floor.id,
			target: space,
			coordinate: space.center,
		});
	}

	return origins;
}

export function getStores(mapData: MapData): Store[] {
	return mapData
		.getByType('enterprise-location')
		.filter(l => l.type === 'tenant' && !l.hidden && l.spaces.length > 0)
		.map(location => {
			const space = location.spaces[0];
			return {
				id: location.id,
				name: displayName(location.name),
				logo: location.logo,
				description: location.description,
				categories: location.categories.map(c => c.name),
				floorId: space.floor.id,
				floorName: space.floor.name,
				location,
				space,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parking areas aren't visible from inside the mall, so they make poor turn landmarks. */
const NOT_LANDMARKS = /^Parking/;
/** Spoken names for amenities that read oddly as-is ("at the Entrance"). */
const SPOKEN_NAMES: Record<string, string> = {
	Entrance: 'the mall entrance',
	'Guest Services - West Wing': 'Guest Services',
};
/** Freestanding kiosks in the middle of a court, visible from well down the corridor. */
const PROMINENT = /^(Information Desk|Guest Services)/;

export function outlineOf(space: Space): LatLon[] | undefined {
	const geometry = space.geoJSON.geometry;
	const ring =
		geometry?.type === 'Polygon'
			? geometry.coordinates[0]
			: geometry?.type === 'MultiPolygon'
				? geometry.coordinates[0]?.[0]
				: undefined;
	return ring?.map(([lon, lat]: number[]) => ({ lat, lon }));
}

/** Named places a visitor can see from the corridor, used to anchor instructions. */
export function getLandmarks(mapData: MapData): Landmark[] {
	const landmarks: Landmark[] = [];
	for (const location of mapData.getByType('enterprise-location')) {
		if (location.hidden || location.type === 'zone' || NOT_LANDMARKS.test(location.name)) continue;
		// Brands read naturally bare ("at Zara"); amenities need an article ("at the ATM").
		const written = displayName(location.name);
		const name = SPOKEN_NAMES[written] ?? (location.type === 'amenities' ? `the ${written}` : written);
		for (const space of location.spaces) {
			landmarks.push({
				name,
				floorId: space.floor.id,
				outline: outlineOf(space),
				prominent: PROMINENT.test(location.name) || undefined,
				...toLatLon(space.center),
			});
		}
	}
	return landmarks;
}

export function getFloorNames(mapData: MapData): Record<string, string> {
	return Object.fromEntries(mapData.getByType('floor').map(f => [f.id, f.name]));
}

export function toLatLon(c: Coordinate): LatLon {
	return { lat: c.latitude, lon: c.longitude };
}

export function toRawInstructions(directions: Directions): RawInstruction[] {
	const instructions = directions.instructions.map(i => ({
		type: i.action.type,
		bearing: i.action.bearing,
		connectionType: i.action.connectionType,
		direction: i.action.direction,
		toFloorName: i.action.toFloor?.name,
		distance: i.distance,
		point: toLatLon(i.coordinate),
		floorId: i.coordinate.floorId ?? '',
	}));
	const path = directions.coordinates.map(c => ({ ...toLatLon(c), floorId: c.floorId ?? '' }));
	return withHeadings(instructions, path);
}

const normalize = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();

/**
 * Everyday words for the venue's categories, so "shoes" finds the Footwear stores and not
 * just the two with "Shoes" in their name. Words are lowercase and accent-free.
 */
const CATEGORY_WORDS: Record<string, string[]> = {
	Footwear: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boots', 'sandals', 'heels'],
	'Food & Drink': ['food', 'eat', 'restaurant', 'lunch', 'dinner', 'coffee', 'snack', 'dessert'],
	'Health & Beauty': ['beauty', 'makeup', 'cosmetics', 'skincare', 'perfume', 'fragrance', 'salon', 'nails', 'hair'],
	'Jewellery & Watches': ['jewelry', 'jewellery', 'jeweler', 'jeweller', 'watch', 'watches', 'rings'],
	"Children's Clothing": ['kids', 'children', 'baby', 'toddler'],
	Electronics: ['tech', 'phone', 'phones', 'mobile', 'computer', 'laptop', 'gaming'],
	Finance: ['bank', 'insurance'],
	Home: ['furniture', 'decor', 'kitchen', 'bedding', 'mattress'],
	'Sports & Fitness': ['sport', 'sports', 'gym', 'fitness', 'athletic', 'yoga'],
	"Women's Fashion": ['clothes', 'clothing', 'fashion', 'womens', 'ladies', 'dresses'],
	"Men's Fashion": ['clothes', 'clothing', 'fashion', 'mens', 'suits'],
};
/** Shorter queries would expand to too many categories while the visitor is still typing. */
const MIN_SYNONYM_QUERY = 3;

/** Categories with an everyday word that starts with the query ("sho" and "shoes" both give Footwear). */
function categoriesMatching(q: string): Set<string> {
	if (q.length < MIN_SYNONYM_QUERY) return new Set();
	return new Set(
		Object.entries(CATEGORY_WORDS)
			.filter(([, words]) => words.some(word => word.startsWith(q)))
			.map(([category]) => category),
	);
}

export function searchStores(stores: Store[], query: string, category?: string): Store[] {
	const q = normalize(query.trim());
	const synonyms = categoriesMatching(q);
	const nameMatches = (store: Store) => normalize(store.name).includes(q);
	const results = stores.filter(store => {
		if (category && !store.categories.includes(category)) return false;
		if (!q) return true;
		return nameMatches(store) || store.categories.some(c => synonyms.has(c) || normalize(c).includes(q));
	});
	// A store named for the query ("Ecco Shoes") is the likelier pick, so it leads; the sort is stable.
	return q ? results.sort((a, b) => Number(nameMatches(b)) - Number(nameMatches(a))) : results;
}
