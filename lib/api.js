// PostgREST client for AiroBase, using the PUBLISHABLE (anon) key — safe to ship
// in a mobile client (read-only under RLS). Mirrors the web app's lib/db pattern.
import { AIROBASE_URL, AIROBASE_ANON_KEY, MEDIA_BASE } from './config';

function headers(extra = {}) {
  return {
    apikey: AIROBASE_ANON_KEY,
    Authorization: `Bearer ${AIROBASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// GET /rest/v1/<table>?<query>. Returns parsed JSON (array) or throws.
export async function select(table, query = '') {
  const url = `${AIROBASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PostgREST ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

// GET with an exact total count (reads the Content-Range header).
export async function selectWithCount(table, query = '') {
  const url = `${AIROBASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const res = await fetch(url, { headers: headers({ Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }) });
  if (!res.ok) throw new Error(`PostgREST ${res.status}`);
  const cr = res.headers.get('content-range') || '';
  const count = cr.includes('/') ? Number(cr.split('/')[1]) : 0;
  // Note: this only fetched the count header; call select() for rows.
  return Number.isFinite(count) ? count : 0;
}

// Turn a stored image path into an absolute URL the app can load.
// DB values are like "/api/media/<key>" (relative) — prefix with MEDIA_BASE.
export function mediaUrl(u) {
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return MEDIA_BASE + u;
  return `${MEDIA_BASE}/${u}`;
}

// PostgREST `like`/`ilike` on AiroBase uses % as the wildcard (URL-encoded %25).
export const like = (s) => encodeURIComponent(`%${s}%`);
