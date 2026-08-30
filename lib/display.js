// Display helpers — build human labels from a shaped listing.
import { beds as bedsFmt, baths as bathsFmt } from './format';

// Property-type label (Spanish), title-cased. Falls back to "Propiedad".
export function typeLabel(l) {
  const t = (l.type || '').trim();
  if (!t) return 'Propiedad';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Canonical type key from a free-text type, + bilingual display name. Shared by
// the marketplace filter pills and the card title so both stay consistent.
const TYPE_MAP = {
  depto: ['Departamento', 'Apartment'], casa: ['Casa', 'House'], duplex: ['Dúplex', 'Duplex'],
  terreno: ['Terreno', 'Land'], comercial: ['Local comercial', 'Commercial'], oficina: ['Oficina', 'Office'],
  deposito: ['Depósito', 'Warehouse'], edificio: ['Edificio', 'Building'], condominio: ['Condominio', 'Condo'],
  otro: ['Propiedad', 'Property'],
};
export function typeKeyOf(t) {
  const s = (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/departamento|depto|apartment/.test(s)) return 'depto';
  if (/duplex/.test(s)) return 'duplex';
  if (/terreno|lote|land|lot/.test(s)) return 'terreno';
  if (/casa|house/.test(s)) return 'casa';
  if (/comercial|local|tienda|negoc/.test(s)) return 'comercial';
  if (/oficina|office/.test(s)) return 'oficina';
  if (/deposito|dep.sito|galp/.test(s)) return 'deposito';
  if (/edificio|building/.test(s)) return 'edificio';
  if (/condominio|condo/.test(s)) return 'condominio';
  return 'otro';
}
export function typeName(l, lang = 'es') {
  const pair = TYPE_MAP[typeKeyOf(l && l.type)] || TYPE_MAP.otro;
  return lang === 'en' ? pair[1] : pair[0];
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
