// Pure listing filters for the map-first search screen — no React Native imports,
// so they run under `node --test` (lib/__tests__/mapFilter.test.mjs).
// applyFilters() is the marketplace filter/sort that used to live inline in
// app/(tabs)/index.js; the bounds helpers keep the list in sync with the map view.
import { distanceKm, NEAR_RADIUS_KM } from './geo.js';

export const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const TYPE_KEYS = ['all', 'casa', 'depto', 'duplex', 'comercial', 'oficina', 'deposito', 'edificio', 'condominio', 'otro'];
export const TYPE_LABELS = { all: 'Todos', casa: 'Casa', depto: 'Departamento', duplex: 'Dúplex', comercial: 'Comercial', oficina: 'Oficina', deposito: 'Depósito', edificio: 'Edificio', condominio: 'Condominio', otro: 'Otro' };
export function typeKey(t) {
  const s = norm(t);
  if (/departamento|depto|apartment/.test(s)) return 'depto';
  if (/duplex/.test(s)) return 'duplex';
  if (/casa|house/.test(s)) return 'casa';
  if (/comercial|local|tienda|negoc/.test(s)) return 'comercial';
  if (/oficina|office/.test(s)) return 'oficina';
  if (/deposito|dep.sito|galp/.test(s)) return 'deposito';
  if (/edificio|building/.test(s)) return 'edificio';
  if (/condominio|condo/.test(s)) return 'condominio';
  return 'otro';
}

export const hasCoords = (l) => l && l.lat != null && l.lng != null && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng));

// Search text + type/beds/price + near-me radius, then sort. Near-me overrides the
// sort (nearest first), same as the website.
export function applyFilters(list, { q = '', typeF = 'all', bedF = 'all', priceF = 'all', mode = 'all', sort = 'relevancia', nearMe = false, userLoc = null, radiusKm = NEAR_RADIUS_KM } = {}) {
  let out = list || [];
  if (q.trim()) {
    const nq = norm(q.trim());
    out = out.filter((l) => [l.neighborhood, l.city, l.address, l.type].some((f) => norm(f).includes(nq)));
  }
  if (typeF !== 'all') out = out.filter((l) => typeKey(l.type) === typeF);
  if (bedF !== 'all') { const m = Number(bedF); out = out.filter((l) => (l.beds || 0) >= m); }
  if (priceF !== 'all') {
    out = out.filter((l) => {
      const v = l.usd || 0;
      if (mode === 'alquiler') return priceF === 'lo' ? v < 500 : priceF === 'mid' ? v >= 500 && v <= 1000 : v > 1000;
      return priceF === 'lo' ? v < 100000 : priceF === 'mid' ? v >= 100000 && v <= 200000 : v > 200000;
    });
  }
  if (nearMe && userLoc) {
    const withD = [];
    for (const l of out) {
      if (!hasCoords(l)) continue;
      const d = distanceKm(userLoc.latitude, userLoc.longitude, l.lat, l.lng);
      if (d <= radiusKm) withD.push([d, l]);
    }
    withD.sort((a, b) => a[0] - b[0]);
    return withD.map((x) => x[1]);
  }
  const usdVal = (l) => l.usd ?? (l.pyg ? l.pyg / 7500 : 0);
  if (sort === 'precio_asc') out = [...out].sort((a, b) => usdVal(a) - usdVal(b));
  else if (sort === 'precio_desc') out = [...out].sort((a, b) => usdVal(b) - usdVal(a));
  else if (sort === 'area_desc') out = [...out].sort((a, b) => (b.covered || b.area || 0) - (a.covered || a.area || 0));
  return out;
}

// b = { n, s, e, w } in degrees; edges inclusive. e < w means the view crosses the antimeridian.
export function inBounds(l, b) {
  if (!hasCoords(l) || !b) return false;
  const lat = Number(l.lat), lng = Number(l.lng);
  if (lat < b.s || lat > b.n) return false;
  return b.e >= b.w ? lng >= b.w && lng <= b.e : lng >= b.w || lng <= b.e;
}

export function filterInBounds(list, b) {
  if (!b) return (list || []).filter(hasCoords);
  return (list || []).filter((l) => inBounds(l, b));
}

export function splitNoCoords(list) {
  const withCoords = [], noCoords = [];
  for (const l of list || []) (hasCoords(l) ? withCoords : noCoords).push(l);
  return { withCoords, noCoords };
}

export function sortByDistance(list, lat, lng) {
  return (list || []).filter(hasCoords)
    .map((l) => [distanceKm(lat, lng, Number(l.lat), Number(l.lng)), l])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
}

// "__bounds__:n,s,e,w,zoom" (posted by the WebView map on idle) → object or null.
export function parseBoundsMsg(str) {
  if (typeof str !== 'string' || str.indexOf('__bounds__:') !== 0) return null;
  const p = str.slice(11).split(',').map(Number);
  if (p.length !== 5 || p.some((x) => !Number.isFinite(x))) return null;
  const [n, s, e, w, zoom] = p;
  return { n, s, e, w, zoom };
}
