// Runtime config, read from app.json → expo.extra (see Constants).
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

export const AIROBASE_URL = extra.airobaseUrl;
export const AIROBASE_ANON_KEY = extra.airobaseAnonKey;
// Stored image URLs in the DB are relative (/api/media/...) — served by the web
// app's proxy. Prefix them with this host on mobile.
export const MEDIA_BASE = extra.mediaBase || 'https://casa-libre.com.py';
// Base for the web app's own API routes (auth, contact-track, feedback, publish).
export const API_BASE = extra.apiBase || 'https://casa-libre.com.py';
export const PYG_PER_USD = Number(extra.pygPerUsd) || 7300;
export const GOOGLE_CLIENT_ID = extra.googleClientId || '';

// Asunción — default map center (matches the web marketplace default).
export const ASUNCION = { latitude: -25.2967, longitude: -57.6359 };
