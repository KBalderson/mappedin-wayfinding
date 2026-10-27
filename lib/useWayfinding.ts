'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

export type Phase = 'parking' | 'directory' | 'preview' | 'navigating';

export type WayfindingState = {
	phase: Phase;
	originId?: string;
	storeId?: string;
	activeStep: number;
};

type Action =
	| { type: 'choose-parking'; originId: string }
	| { type: 'change-parking' }
	| { type: 'choose-store'; storeId: string }
	| { type: 'back-to-directory' }
	| { type: 'start' }
	| { type: 'go-to-step'; index: number }
	| { type: 'end' };

function reducer(state: WayfindingState, action: Action): WayfindingState {
	switch (action.type) {
		case 'choose-parking':
			return { ...state, originId: action.originId, phase: state.storeId ? 'preview' : 'directory', activeStep: 0 };
		case 'change-parking':
			return { ...state, phase: 'parking', activeStep: 0 };
		case 'choose-store':
			return { ...state, storeId: action.storeId, phase: state.originId ? 'preview' : 'parking', activeStep: 0 };
		case 'back-to-directory':
		case 'end':
			return { ...state, storeId: undefined, phase: 'directory', activeStep: 0 };
		case 'start':
			return { ...state, phase: 'navigating', activeStep: 0 };
		case 'go-to-step':
			return { ...state, activeStep: action.index };
	}
}

const PARKING_KEY = 'wayfinding:parking';
const RECENTS_KEY = 'wayfinding:recent-stores';
const MAX_RECENTS = 5;

function readStorage<T>(key: string, fallback: T): T {
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function writeStorage(key: string, value: unknown) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Private mode or blocked storage: remembering is a convenience, not a requirement.
	}
}

export function readRecentStoreIds(): string[] {
	return readStorage<string[]>(RECENTS_KEY, []);
}

/**
 * Initial state comes from the URL first (`?from=garage-main&to=<location id>`, which is
 * what a QR code at a parking entrance would encode), then the remembered parking spot.
 */
function initialState(validOrigins: Set<string>, validStores: Set<string>): WayfindingState {
	const params = new URLSearchParams(window.location.search);
	const fromParam = params.get('from');
	const toParam = params.get('to');
	const remembered = readStorage<string | null>(PARKING_KEY, null);

	const originId = [fromParam, remembered].find((id): id is string => !!id && validOrigins.has(id));
	const storeId = toParam && validStores.has(toParam) ? toParam : undefined;
	const phase: Phase = !originId ? 'parking' : storeId ? 'preview' : 'directory';
	return { phase, originId, storeId, activeStep: 0 };
}

export function useWayfinding(originIds: string[], storeIds: string[]) {
	const [state, dispatch] = useReducer(reducer, undefined, () =>
		initialState(new Set(originIds), new Set(storeIds)),
	);

	// Keep the URL shareable and remember the parking spot across visits.
	useEffect(() => {
		const url = new URL(window.location.href);
		if (state.originId) url.searchParams.set('from', state.originId);
		else url.searchParams.delete('from');
		if (state.storeId) url.searchParams.set('to', state.storeId);
		else url.searchParams.delete('to');
		window.history.replaceState(null, '', url);
		if (state.originId) writeStorage(PARKING_KEY, state.originId);
	}, [state.originId, state.storeId]);

	const lastStore = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (!state.storeId || state.storeId === lastStore.current) return;
		lastStore.current = state.storeId;
		const recents = [state.storeId, ...readRecentStoreIds().filter(id => id !== state.storeId)];
		writeStorage(RECENTS_KEY, recents.slice(0, MAX_RECENTS));
	}, [state.storeId]);

	return {
		state,
		chooseParking: useCallback((originId: string) => dispatch({ type: 'choose-parking', originId }), []),
		changeParking: useCallback(() => dispatch({ type: 'change-parking' }), []),
		chooseStore: useCallback((storeId: string) => dispatch({ type: 'choose-store', storeId }), []),
		backToDirectory: useCallback(() => dispatch({ type: 'back-to-directory' }), []),
		start: useCallback(() => dispatch({ type: 'start' }), []),
		goToStep: useCallback((index: number) => dispatch({ type: 'go-to-step', index }), []),
		end: useCallback(() => dispatch({ type: 'end' }), []),
	};
}
