// Runtime config. Global values (AiroBase, Google client) come from
// app.json → expo.extra. Everything that differs per COUNTRY (site origin used
// for /api/mobile/*, image prefixing and auth; USD→local rate; map center) is
// read from the ACTIVE country (lib/country.js) via the getters below, so one
// build serves py / bo / uy. Paraguay's profile carries the exact values that
// used to be hardcoded here, so PY is byte-identical.
import Constants from 'expo-constants';
import { getCountry } from './country';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

export const AIROBASE_URL = extra.airobaseUrl;
export const AIROBASE_ANON_KEY = extra.airobaseAnonKey;
export const GOOGLE_CLIENT_ID = extra.googleClientId || '';

// ── Country-dynamic runtime values (call at use-time; they follow the switcher) ──

// Base for the buyer portal API (auth, contact-track, feedback, publish) AND
// the /api/mobile/* listings API — the active country's site.
export function getApiBase() { return getCountry().origin; }

// Host to prefix stored image paths (/api/media/...) with.
export function getMediaBase() { return getCountry().origin; }

// USD → local currency multiplier for the secondary price line.
export function getUsdRate() { return getCountry().usdRate; }

// Default map center for the active country (react-native-maps / WebView map).
export function getMapCenter() { return getCountry().mapCenter; }
