// ─────────────────────────────────────────────────────────────────────────────
// Per-country configuration — the mobile mirror of the web buyer portal's
// lib/country.js. ONE app serves every country; the active country is decided at
// RUNTIME (see CountryProvider / detectCountry below), not baked at build time.
//
// Detection order (first hit wins):
//   1. the user's saved manual choice (AsyncStorage)
//   2. the device region (expo-localization getLocales()[0].regionCode)
//   3. an IP lookup that honors Cloudflare's CF-IPCountry header
//      (GET <py-origin>/api/mobile/geo → { country })
//   4. fall back to Paraguay ('py')
//
// ⚠️ PARAGUAY IS THE DEFAULT AND MUST STAY BYTE-IDENTICAL. Every value in the
// `py` profile is the exact literal that used to be hardcoded in lib/config.js /
// lib/format.js / lib/contact.js / components/PropertyMap.js, so with the active
// country 'py' the app renders and behaves exactly as before.
//
// 🚩 BO / UY are best-effort seeds (currency/map/phone correct; refine with real
// local data) — mirroring the web profiles.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

// Origins/rate for Paraguay come from app.json → expo.extra so PY stays byte-identical
// with the previous hardcoded config (apiBase/mediaBase = casa-libre.com.py, 7300).
const PY_ORIGIN = extra.apiBase || extra.mediaBase || 'https://casa-libre.com.py';
const PY_RATE = Number(extra.pygPerUsd) || 7300;

export const PROFILES = {
  // ===========================================================================
  // PARAGUAY — canonical. Values copied verbatim from the previously-hardcoded
  // mobile config (ASUNCION center, PYG_PER_USD, 'Gs ' + de-DE, prefix 595).
  // ===========================================================================
  py: {
    code: 'py',
    name: 'Paraguay',
    flag: '🇵🇾',
    tld: '.py',
    capital: 'Asunción',
    origin: PY_ORIGIN,                                  // /api/mobile/*, media, auth
    currencyCode: 'PYG',
    moneyPrefix: 'Gs ',                                 // lib/format.js pyg() — no ₲ glyph (font gap)
    moneyLocale: 'de-DE',                               // dot thousands separators
    usdRate: PY_RATE,                                   // USD -> local for secondary price
    mapCenter: { latitude: -25.2967, longitude: -57.6359 }, // ex-ASUNCION
    mapZoom: 12,
    singleZoom: 15,
    phonePrefix: '595',
  },

  // ===========================================================================
  // BOLIVIA — 🚩 VERIFY seeds
  // ===========================================================================
  bo: {
    code: 'bo',
    name: 'Bolivia',
    flag: '🇧🇴',
    tld: '.bo',
    capital: 'Santa Cruz de la Sierra',
    origin: 'https://casa-libre.com.bo',
    currencyCode: 'BOB',
    moneyPrefix: 'Bs ',
    moneyLocale: 'es-BO',
    usdRate: 12.5,
    mapCenter: { latitude: -17.7833, longitude: -63.1821 }, // Santa Cruz
    mapZoom: 11,
    singleZoom: 15,
    phonePrefix: '591',
  },

  // ===========================================================================
  // URUGUAY — 🚩 VERIFY seeds
  // ===========================================================================
  uy: {
    code: 'uy',
    name: 'Uruguay',
    flag: '🇺🇾',
    tld: '.uy',
    capital: 'Montevideo',
    // Uruguay is deployed on a SUBDOMAIN (uy.casa-libre.com), not the ccTLD
    // casa-libre.com.uy (which is not registered/live). The origin serves the
    // /api/mobile/* feed, media and auth for UY — using the ccTLD 404s (no data).
    origin: 'https://uy.casa-libre.com',
    currencyCode: 'UYU',
    moneyPrefix: '$U ',
    moneyLocale: 'es-UY',
    usdRate: 40,
    mapCenter: { latitude: -34.9011, longitude: -56.1645 }, // Montevideo
    mapZoom: 11,
    singleZoom: 15,
    phonePrefix: '598',
  },

  // ===========================================================================
  // VENEZUELA — 🚩 VERIFY seeds. Own ccTLD casa-libre.com.ve. Real estate is
  // priced in US DOLLARS in practice, so USD is primary (usdRate 1 = no convert).
  // ===========================================================================
  ve: {
    code: 've',
    name: 'Venezuela',
    flag: '🇻🇪',
    tld: '.ve',
    capital: 'Caracas',
    origin: 'https://casa-libre.com.ve',
    currencyCode: 'USD',
    moneyPrefix: 'US$ ',
    moneyLocale: 'en-US',
    usdRate: 1,
    mapCenter: { latitude: 10.4806, longitude: -66.9036 }, // Caracas
    mapZoom: 11,
    singleZoom: 15,
    phonePrefix: '58',
  },
};

export const SUPPORTED = ['py', 'bo', 'uy', 've'];
export const DEFAULT_CODE = 'py';
export const COUNTRY_KEY = 'cl.country.v1';

// ISO region code (from the device or the CF-IPCountry header) -> supported code.
const REGION_TO_CODE = { PY: 'py', BO: 'bo', UY: 'uy', VE: 've' };
export function codeFromRegion(region) {
  const r = String(region || '').trim().toUpperCase();
  const c = REGION_TO_CODE[r] || (PROFILES[r.toLowerCase()] ? r.toLowerCase() : null);
  return c && PROFILES[c] ? c : null;
}

// ── Module-level active country (read by non-React code: listings/contact/etc.) ──
let _code = DEFAULT_CODE;
export function getCountryCode() { return _code; }
export function getCountry() { return PROFILES[_code] || PROFILES.py; }
function _setCode(c) { if (PROFILES[c]) _code = c; }
export function countryConfig(c) { return PROFILES[String(c || '').toLowerCase()] || null; }

// IP-based country via Cloudflare's CF-IPCountry header, surfaced by a small
// buyer-portal route (GET /api/mobile/geo → { country: 'PY' }). Never throws.
// The probe hits the PY origin because we don't yet know the country.
export async function fetchGeoCountry() {
  try {
    const res = await fetch(`${PROFILES.py.origin}/api/mobile/geo`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return codeFromRegion(data?.country);
  } catch {
    return null;
  }
}

// Full detection chain. Returns a supported code, never throws.
export async function detectCountry() {
  // 1. saved manual choice
  try {
    const saved = await AsyncStorage.getItem(COUNTRY_KEY);
    if (saved && PROFILES[saved]) return saved;
  } catch {}
  // 2. device region
  try {
    const region = Localization.getLocales?.()?.[0]?.regionCode;
    const c = codeFromRegion(region);
    if (c) return c;
  } catch {}
  // 3. IP lookup (CF-IPCountry)
  const ip = await fetchGeoCountry();
  if (ip) return ip;
  // 4. Paraguay
  return DEFAULT_CODE;
}

// ── React context so UI re-renders against the active country ────────────────
const CountryContext = createContext({
  code: DEFAULT_CODE,
  country: PROFILES.py,
  setCountry: () => {},
  ready: false,
});

export function CountryProvider({ children }) {
  const [code, setCodeState] = useState(DEFAULT_CODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const detected = await detectCountry();
      if (!alive) return;
      _setCode(detected);       // keep module-level in sync for non-React callers
      setCodeState(detected);
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // Manual override — persisted; updates both the module-level value and state.
  const setCountry = useCallback((c) => {
    if (!PROFILES[c] || c === _code) return;
    _setCode(c);
    setCodeState(c);
    AsyncStorage.setItem(COUNTRY_KEY, c).catch(() => {});
  }, []);

  return (
    <CountryContext.Provider value={{ code, country: PROFILES[code] || PROFILES.py, setCountry, ready }}>
      {children}
    </CountryContext.Provider>
  );
}

export const useCountry = () => useContext(CountryContext);
