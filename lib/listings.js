// Listings client — reads the buyer portal's mobile API, which returns listings
// already shaped + completeness-gated (same logic as the website). The secret
// AiroBase key stays on the server; the app never talks to PostgREST directly
// (anon reads are RLS-blocked).
//
// Shaped listing fields the UI consumes: id, slug, lat, lng, mode, price,
// currency, usd, pyg, type, city, neighborhood, province, address, beds, baths,
// parking, area, covered, lot, created_at, image, images[], description,
// features[], external_url, contact_name, contact_phone, user_published.
import { API_BASE, MEDIA_BASE } from './config';

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
  return MEDIA_BASE + (u.startsWith('/') ? u : '/' + u);
}
function fixImages(l) {
  if (!l) return l;
  return { ...l, image: abs(l.image), images: Array.isArray(l.images) ? l.images.map(abs).filter(Boolean) : [] };
}

// mode: 'venta' | 'alquiler' | undefined (all)
export async function fetchListings({ mode, limit = 600 } = {}) {
  const qs = new URLSearchParams();
  if (mode === 'venta' || mode === 'alquiler') qs.set('mode', mode);
  qs.set('limit', String(limit));
  const { rate, listings } = await j(`${API_BASE}/api/mobile/listings?${qs.toString()}`);
  return { rate, listings: (listings || []).map(fixImages) };
}

export async function fetchListing(id) {
  const { listing } = await j(`${API_BASE}/api/mobile/listing/${encodeURIComponent(id)}`);
  return listing ? fixImages(listing) : null;
}

export async function fetchListingsByIds(ids) {
  if (!ids || !ids.length) return { listings: [] };
  const { listings } = await j(`${API_BASE}/api/mobile/byids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return { listings: (listings || []).map(fixImages) };
}
