// Pure geo helpers + a native location wrapper — mirrors the web buyer portal's
// utils/geo.js (distanceKm, NEAR_RADIUS_KM), with getUserLocation implemented on
// top of expo-location instead of the browser's navigator.geolocation.

// Great-circle distance in kilometres between two lat/lng points (haversine).
// Same formula the website uses so "near me" matches across web + mobile.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // mean Earth radius (km)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Default "near me" radius (km) — shared with the website.
export const NEAR_RADIUS_KM = 10;

// Ask for permission (gracefully) and read the device location. Never rejects —
// resolves to { latitude, longitude } on success, or null if denied/unavailable.
// Safe to call from an event handler. Uses a require() so the (native) module is
// only pulled in when actually needed.
export async function getUserLocation() {
  try {
    const Location = require('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (!pos?.coords) return null;
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}
