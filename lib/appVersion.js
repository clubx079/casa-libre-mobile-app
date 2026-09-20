// ─────────────────────────────────────────────────────────────────────────────
// Force-update plumbing (Layer A: native "minimum supported version" gate).
//
// After we publish a new STORE build, users on an old binary must be pushed to
// update. This module knows three things:
//   1. what version is installed on this device  (getInstalledVersion)
//   2. how to compare two version strings safely (compareVersions / isBelow)
//   3. how to fetch the remote policy from a route we control on the buyer
//      portal                                     (fetchAppVersionConfig)
//
// The UI that acts on it lives in components/UpdateGate.js.
//
// FAIL-OPEN CONTRACT: any network / parse failure returns null and the app is
// NOT locked. We only ever block on a *definitive* min-version answer from the
// server. Never trap a user offline behind an "update required" wall.
// ─────────────────────────────────────────────────────────────────────────────
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBase } from './config';

// ── Installed native app version ─────────────────────────────────────────────
// The "installed version" is the CFBundleShortVersionString (iOS) / versionName
// (Android) baked into the binary — which for a store build equals app.json's
// `expo.version` at build time.
//
// The most accurate source is expo-application's `nativeApplicationVersion`, but
// that package is NOT installed yet (a static import would break the Metro
// bundle). To enable it:
//     npx expo install expo-application
// then swap the expo-constants read below for:
//     import * as Application from 'expo-application';
//     return String(Application.nativeApplicationVersion || '0.0.0');
//
// Until then we use expo-constants, which is already a dependency. In a
// production/TestFlight/store build `Constants.expoConfig.version` is the value
// compiled into the app; `Constants.nativeAppVersion` is a legacy fallback.
export function getInstalledVersion() {
  return String(
    Constants.expoConfig?.version ||
      Constants.nativeAppVersion ||
      Constants.manifest?.version ||
      Constants.manifest2?.extra?.expoClient?.version ||
      '0.0.0'
  );
}

// ── Semver-ish comparison ────────────────────────────────────────────────────
// Splits on "." and compares numeric segments left→right. Non-numeric segments
// and pre-release tags ("1.2.0-beta.3") are stripped so they never throw or
// mis-sort. Missing segments count as 0 ("1.2" === "1.2.0"). Junk → treated as
// 0.0.0 which, combined with the fail-open callers, never locks a user out.
export function normalizeVersion(v) {
  return String(v == null ? '' : v)
    .trim()
    .replace(/^v/i, '')          // tolerate a leading "v"
    .split(/[-+]/)[0]            // drop -prerelease / +build metadata
    .split('.')
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

// Returns -1 if a < b, 0 if equal, 1 if a > b.
export function compareVersions(a, b) {
  const pa = normalizeVersion(a);
  const pb = normalizeVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

// True when `version` is strictly older than `floor`. A missing/invalid floor
// returns false (never block on garbage).
export function isBelow(version, floor) {
  if (floor == null || floor === '') return false;
  return compareVersions(version, floor) < 0;
}

// Keep only string version-ish values; otherwise null (so callers can tell
// "server said nothing" from "server said 1.2.3").
function cleanVer(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ── Store deep-links (fallbacks if the server doesn't send storeUrl) ──────────
// iOS app id comes from eas.json → submit.production.ios.ascAppId (6805488261).
// Android package comes from app.json → expo.android.package.
const IOS_APP_ID = '6805488261';
const ANDROID_PACKAGE =
  Constants.expoConfig?.android?.package || 'py.casalibre.mobile';

export function defaultStoreUrl() {
  return Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}

// ── Remote policy fetch ──────────────────────────────────────────────────────
// Hits a small route we control on the active country's buyer-portal origin
// (the app already calls `${origin}/api/mobile/*`, see lib/country.js):
//
//   GET {origin}/api/mobile/app-version?platform=ios|android&version=<installed>
//
// Expected JSON (all fields optional; unknown fields ignored):
//   {
//     "minVersion":    "1.1.0",   // hard floor — below this the app is blocked
//     "latestVersion": "1.3.0",   // newest in the store — soft "update available"
//     "storeUrl":      "https://apps.apple.com/app/id6805488261"  // optional override
//   }
//
// Returns null on ANY failure (offline, non-2xx, bad JSON) → fail open.
export async function fetchAppVersionConfig({ timeoutMs = 6000 } = {}) {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const installed = getInstalledVersion();
  const url = `${getApiBase()}/api/mobile/app-version?platform=${platform}&version=${encodeURIComponent(
    installed
  )}`;

  // Abort the request if the server is slow so startup is never held hostage.
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    return {
      minVersion: cleanVer(data.minVersion),
      latestVersion: cleanVer(data.latestVersion),
      storeUrl: cleanVer(data.storeUrl) || defaultStoreUrl(),
    };
  } catch {
    return null; // fail open
  } finally {
    if (timer) clearTimeout(timer);
  }
}
