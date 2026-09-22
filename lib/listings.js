// Listings client — reads the buyer portal's mobile API, which returns listings
// already shaped + completeness-gated (same logic as the website). The secret
// AiroBase key stays on the server; the app never talks to PostgREST directly
// (anon reads are RLS-blocked).
//
// Shaped listing fields the UI consumes: id, slug, lat, lng, mode, price,
// currency, usd, pyg, type, city, neighborhood, province, address, beds, baths,
// parking, area, covered, lot, created_at, image, images[], description,
// features[], external_url, contact_name, contact_phone, user_published.
import { getApiBase, getMediaBase } from './config';

async function j(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// The API returns image paths RELATIVE to the web host (/api/media/...). RN's
// <Image> needs absolute URLs, so prefix them with the media host.
function abs(u) {
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return getMediaBase() + (u.startsWith('/') ? u : '/' + u);
}
function fixImages(l) {
  if (!l) return l;
  return { ...l, image: abs(l.image), images: Array.isArray(l.images) ? l.images.map(abs).filter(Boolean) : [] };
}

// mode: 'venta' | 'alquiler' | undefined (all)
// slim=1 → the whole catalog with card/map fields only (no contact/description/
// image array); servers without the slim feed ignore it and return ≤600 full rows.
export async function fetchListings({ mode, limit = 5000 } = {}) {
  const qs = new URLSearchParams();
  if (mode === 'venta' || mode === 'alquiler') qs.set('mode', mode);
  qs.set('slim', '1');
  qs.set('limit', String(limit));
  const { rate, listings, total, count } = await j(`${getApiBase()}/api/mobile/listings?${qs.toString()}`);
  return { rate, total: total ?? count ?? (listings ? listings.length : 0), listings: (listings || []).map(fixImages) };
}

export async function fetchListing(id) {
  const { listing } = await j(`${getApiBase()}/api/mobile/listing/${encodeURIComponent(id)}`);
  return listing ? fixImages(listing) : null;
}

export async function fetchListingsByIds(ids) {
  if (!ids || !ids.length) return { listings: [] };
  const { listings } = await j(`${getApiBase()}/api/mobile/byids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return { listings: (listings || []).map(fixImages) };
}
