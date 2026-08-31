// Display helpers — build human labels from a shaped listing.
import { beds as bedsFmt, baths as bathsFmt } from './format';

// Property-type label (Spanish), title-cased. Falls back to "Propiedad".
export function typeLabel(l) {
  const t = (l.type || '').trim();
  if (!t) return 'Propiedad';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// A card/detail title: "Casa · Villa Morra" (type · zone).
export function title(l) {
  const zone = l.neighborhood || l.city || l.province || '';
  return zone ? `${typeLabel(l)} · ${zone}` : typeLabel(l);
}

export function modeLabel(l, lang = 'es') {
  if (l.mode === 'alquiler') return lang === 'en' ? 'For rent' : 'En alquiler';
  return lang === 'en' ? 'For sale' : 'En venta';
}

// "3 dorm. · 2 baños · 180 m²"
export function metaLine(l, lang = 'es') {
  const parts = [];
  if (l.beds != null) parts.push(bedsFmt(l.beds, lang));
  if (l.baths != null) parts.push(bathsFmt(l.baths, lang));
  const a = l.covered || l.area;
  if (a) parts.push(`${Math.round(a)} m²`);
  return parts.join('  ·  ');
}

export const zoneLine = (l) => [l.neighborhood, l.city].filter(Boolean).join(', ');
