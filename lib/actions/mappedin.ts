'use server';

const AUTH_URL = 'https://auth.mappedin.com/oauth2/token';
// Refresh a little before the real expiry so a client never receives a nearly-dead token.
const EXPIRY_BUFFER_MS = 10 * 60 * 1000;

export type MapCredentials = {
	accessToken: string;
	mapId: string;
	expiresAt: number;
};

let cached: MapCredentials | undefined;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local.`);
	return value;
}

/**
 * Mints a short-lived Mappedin access token on the server so the API key/secret
 * never reach the browser. The SDK detects enterprise mode from the token itself.
 */
export async function getMapCredentials(): Promise<MapCredentials> {
	if (cached && cached.expiresAt - EXPIRY_BUFFER_MS > Date.now()) return cached;

	const res = await fetch(AUTH_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: requireEnv('MAPPEDIN_KEY'),
			client_secret: requireEnv('MAPPEDIN_SECRET'),
		}),
		cache: 'no-store',
	});
	if (!res.ok) throw new Error(`Mappedin auth failed (${res.status})`);

	const body = (await res.json()) as { access_token: string; expires_in: number };
	cached = {
		accessToken: body.access_token,
		mapId: requireEnv('MAPPEDIN_MAP_ID'),
		expiresAt: Date.now() + body.expires_in * 1000,
	};
	return cached;
}
