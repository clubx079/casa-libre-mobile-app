// Contact helpers: normalize Paraguay phones, build WhatsApp/tel links, and
// fire contact-tracking + report-unresponsive to the web API.
import { getApiBase } from './config';
import { getCountry } from './country';

// Strip non-digits; ensure the active country's dialing prefix (drop a leading 0).
// For Paraguay the prefix is 595, so PY behaves exactly as before.
export function normalizePhone(phone) {
  const prefix = getCountry().phonePrefix || '595';
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith(prefix)) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return prefix + d;
}
// Back-compat alias (call sites still import normalizePy).
export const normalizePy = normalizePhone;

export function waLink(phone, message) {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function telLink(phone) {
  return `tel:${normalizePhone(phone)}`;
}

// Random token for UTM attribution (matches the web contact tracking).
export function genToken() {
  return 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// The tracked property URL embedded in the WhatsApp message.
export function trackedUrl(listingId, token) {
  return `${getCountry().origin}/propiedad/${listingId}?utm_source=whatsapp&utm_medium=seller_contact&utm_campaign=property_share&t=${token}`;
}

// The WhatsApp message is ALWAYS Spanish (brand rule), in both UI languages.
export function waMessage(listingId, token) {
  return `¡Hola! ¿Sigue disponible esta propiedad?\n${trackedUrl(listingId, token)}`;
}

// Best-effort: record that a buyer opened a seller contact (fire and forget).
export function trackContact({ listingId, token, channel }) {
  try {
    fetch(`${getApiBase()}/api/contact-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: listingId, token, channel, source: 'mobile' }),
    }).catch(() => {});
  } catch {}
}

export function reportUnresponsive(listingId, { message = '', listingRef = '', sellerPhone = '', reporterName = '', reporterContact = '' } = {}) {
  return fetch(`${getApiBase()}/api/report-unresponsive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: listingId,
      listing_ref: listingRef,
      message: message || 'El publicador no responde.',
      seller_phone: sellerPhone,
      reporter_name: reporterName,
      reporter_contact: reporterContact,
      source: 'mobile',
    }),
  }).then((r) => r.ok).catch(() => false);
}
