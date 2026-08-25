// Price / label formatting — mirrors the buyer portal's lib/ui.js.
import { PYG_PER_USD } from './config';

// Compact USD: US$ 850, US$ 92k, US$ 1.2M. Handles rentals (<1000) exactly.
export function shortUsd(n) {
  n = Number(n) || 0;
  if (n < 1000) return 'US$ ' + Math.round(n);
  if (n < 1_000_000) return 'US$ ' + Math.round(n / 1000) + 'k';
  return 'US$ ' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// Full USD with thousands separators: US$ 92,000
export function fullUsd(n) {
  n = Number(n) || 0;
  return 'US$ ' + Math.round(n).toLocaleString('en-US');
}

// Guaraníes: Gs 550.000.000 (dot separators, PY style). We use "Gs" not the ₲
// glyph because the app fonts (Space Grotesk / IBM Plex Mono) don't include ₲,
// so it would render as a broken box on device.
export function pyg(usd) {
  const g = Math.round((Number(usd) || 0) * PYG_PER_USD);
  return 'Gs ' + g.toLocaleString('de-DE');
}

// Convert a stored price to USD amount, given its currency.
export function toUsd(price, currency) {
  const p = Number(price) || 0;
  if (!currency || currency === 'USD') return p;
  if (currency === 'PYG' || currency === 'GS' || currency === '₲') return p / PYG_PER_USD;
  return p;
}

// baño(s) / dormitorio(s) / cochera(s) — singular/plural helper (ES + EN).
export function plural(n, singular, pluralForm) {
  const v = Number(n) || 0;
  return `${v} ${v === 1 ? singular : pluralForm}`;
}

export function beds(n, lang = 'es') {
  return lang === 'en' ? plural(n, 'bed', 'beds') : plural(n, 'dorm.', 'dorm.');
}
export function baths(n, lang = 'es') {
  return lang === 'en' ? plural(n, 'bath', 'baths') : plural(n, 'baño', 'baños');
}

export const REF = (id) => 'CL-' + String(id || '').slice(0, 6).toUpperCase();
