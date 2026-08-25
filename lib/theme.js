// Casa Libre brand tokens — mirrors the buyer portal.
// ink #111 on paper #f9f4ee, Space Grotesk (sans) / Instrument Serif italic (display)
// / IBM Plex Mono (labels & data). Pill buttons, hard offset shadow, no emojis.
// Green #25D366 is functional-only (WhatsApp).

export const colors = {
  ink: '#111111',
  paper: '#f9f4ee',
  card: '#ffffff',
  // ink with alpha, for hairlines / muted text (matches Tailwind ink/XX usage)
  ink04: 'rgba(17,17,17,0.04)',
  ink08: 'rgba(17,17,17,0.08)',
  ink12: 'rgba(17,17,17,0.12)',
  ink30: 'rgba(17,17,17,0.30)',
  ink45: 'rgba(17,17,17,0.45)',
  ink60: 'rgba(17,17,17,0.60)',
  ink70: 'rgba(17,17,17,0.70)',
  whatsapp: '#25D366',
  danger: '#c0392b',
  success: '#2e7d32',
  hatch: '#efe7db', // placeholder ground
};

export const fonts = {
  // Loaded in app/_layout.js via @expo-google-fonts
  sans: 'SpaceGrotesk_400Regular',
  sansMed: 'SpaceGrotesk_500Medium',
  sansBold: 'SpaceGrotesk_700Bold',
  serif: 'InstrumentSerif_400Regular_Italic',
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
};

export const radii = {
  pill: 999,
  card: 18,
  sm: 10,
};

export const space = (n) => n * 4;

// Casa Libre hard shadow — a solid offset block, not a soft blur.
export const hardShadow = {
  shadowColor: colors.ink,
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
};

export const softShadow = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 2,
};
