import type { MapData } from '@mappedin/mappedin-js';
import { describe, expect, it } from 'vitest';
import { displayName, getLandmarks, getStores, searchStores, type Store } from './mall';

// Search only reads names and categories, so the SDK objects can be left out.
const store = (name: string, ...categories: string[]) =>
	({ id: name, name, categories, floorId: 'lower', floorName: 'Lower Level' }) as unknown as Store;

const stores = [
	store('Aldo', 'Footwear'),
	store('Ecco Shoes', 'Footwear'),
	store('Foot Locker', 'Footwear', 'Sports & Fitness'),
	store('Groovy Shoes', 'Footwear'),
	store('Aritzia', "Women's Fashion"),
	store('Café Nero', 'Food & Drink'),
	store('Sephora', 'Health & Beauty'),
];
const names = (results: Store[]) => results.map(s => s.name);

describe('searchStores', () => {
	it('matches store names and category names', () => {
		expect(names(searchStores(stores, 'seph'))).toEqual(['Sephora']);
		expect(names(searchStores(stores, 'footwear'))).toEqual(['Aldo', 'Ecco Shoes', 'Foot Locker', 'Groovy Shoes']);
	});

	it('ignores case, surrounding spaces and accents', () => {
		expect(names(searchStores(stores, '  CAFE '))).toEqual(['Café Nero']);
	});

	it('finds a category by an everyday word, with stores named for it first', () => {
		expect(names(searchStores(stores, 'shoes'))).toEqual(['Ecco Shoes', 'Groovy Shoes', 'Aldo', 'Foot Locker']);
		expect(names(searchStores(stores, 'sneakers'))).toEqual(['Aldo', 'Ecco Shoes', 'Foot Locker', 'Groovy Shoes']);
		expect(names(searchStores(stores, 'makeup'))).toEqual(['Sephora']);
		expect(names(searchStores(stores, 'womens'))).toEqual(['Aritzia']);
	});

	it('expands synonyms while typing, but not from a very short query', () => {
		expect(names(searchStores(stores, 'sho'))).toEqual(['Ecco Shoes', 'Groovy Shoes', 'Aldo', 'Foot Locker']);
		// Two letters only match names and category names ("fa-sh-ion"), not the everyday words.
		expect(names(searchStores(stores, 'sh'))).toEqual(['Ecco Shoes', 'Groovy Shoes', 'Aritzia']);
	});

	it('keeps the category chip as a filter on synonym matches', () => {
		expect(names(searchStores(stores, 'shoes', 'Sports & Fitness'))).toEqual(['Foot Locker']);
	});

	it('keeps A–Z order with no query, and finds nothing for an unknown word', () => {
		expect(names(searchStores(stores, ''))).toEqual(names(stores));
		expect(searchStores(stores, 'zzzz')).toEqual([]);
	});
});

describe('venue name fixes', () => {
	// A tenant as the SDK returns it, reduced to what getStores and getLandmarks read.
	const tenant = (name: string) => ({
		id: name,
		name,
		type: 'tenant',
		hidden: false,
		categories: [],
		spaces: [{ floor: { id: 'lower', name: 'Lower Level' }, center: { latitude: 43.86, longitude: -78.95 }, geoJSON: {} }],
	});
	const venue = (...names: string[]) =>
		({ getByType: (type: string) => (type === 'enterprise-location' ? names.map(tenant) : []) }) as unknown as MapData;

	it('corrects misspellings in the directory, the directions and search', () => {
		const mapData = venue('Nordstorm');
		expect(getStores(mapData).map(s => s.name)).toEqual(['Nordstrom']);
		expect(getLandmarks(mapData).map(l => l.name)).toEqual(['Nordstrom']);
		expect(names(searchStores(getStores(mapData), 'nordstrom'))).toEqual(['Nordstrom']);
	});

	it('passes names through untouched once the venue data is fixed', () => {
		expect(displayName('Nordstrom')).toBe('Nordstrom');
		expect(displayName('Nordstrom Rack')).toBe('Nordstrom Rack');
		expect(getStores(venue('Nordstrom')).map(s => s.name)).toEqual(['Nordstrom']);
	});
});
