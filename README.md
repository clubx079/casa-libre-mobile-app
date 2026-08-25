# Casa Libre — Mobile App (React Native / Expo)

The native companion to the Casa Libre buyer portal (`casa-libre.com.py`). Same
AiroBase backend, same brand. Browse buy/rent listings, view details, contact
sellers on WhatsApp, save favorites, publish a property, and more.

## Stack
- **Expo SDK 51** + **expo-router** (file-based routing, mirrors the web app's routes)
- Plain JavaScript, `react-native-maps` (listing + detail maps), `expo-image`
- Fonts: Space Grotesk / Instrument Serif italic / IBM Plex Mono (brand)

## Backend
The app does **not** talk to PostgREST directly (the anon key is RLS-blocked).
It reads a small **mobile API** added to the buyer portal:
- `GET /api/mobile/listings?mode=venta|alquiler&limit=` → `{ rate, count, listings[] }`
- `GET /api/mobile/listing/:id` → `{ listing }`
- `POST /api/mobile/byids` `{ ids }` → `{ listings }`

Listings arrive already **shaped** and **completeness-gated** (same logic as the
website), so the secret key never leaves the server. Auth, publish, feedback,
partner-inquiries, and contact-tracking reuse the existing web API routes.
Session is the web app's httpOnly `cl_session` cookie — on native, RN's cookie
jar stores and re-sends it automatically.

Config lives in `app.json → expo.extra` (`airobaseUrl`, `mediaBase`, `apiBase`,
`pygPerUsd`, `googleClientId`). Images are served from `mediaBase/api/media/...`.

## Run (development)
```bash
cd casa-libre-mobile-app
npm install
npx expo start
```
Scan the QR with **Expo Go** (Android) or the Camera app (iOS). Maps need a
development build (`react-native-maps` isn't in Expo Go on iOS): `npx expo run:ios`
/ `npx expo run:android`, or build with EAS.

## Build & deploy (EAS)
```bash
npm i -g eas-cli
eas login
eas build --profile preview --platform android   # internal APK
eas build --profile production --platform all     # store builds
eas submit --platform android                     # / ios
```

## Screens
- **Search** (`app/(tabs)/index.js`) — marketplace: mode chips, search, type/price/beds filters, list ↔ map, pagination.
- **Property** (`app/property/[id].js`) — gallery + lightbox, price, specs, description, features, location map, WhatsApp/Call/Copy contact, sticky bar.
- **Saved** (`app/(tabs)/saved.js`) — local favorites.
- **Publish** (`app/(tabs)/publish.js`) — login-gated multipart publish.
- **Account** (`app/(tabs)/account.js`) + **Auth** (`app/auth.js`) — email OTP / password / Google.
- **Empresas** (`app/empresas.js`), **Feedback** (`app/feedback.js`).

## Project map
- `lib/` — `config`, `api`, `listings` (API client), `format`, `display`, `contact`, `favorites`, `i18n`, `session`, `theme`
- `components/` — `PropertyCard`, `PropertyMap`, `ImageGallery`, `ContactCard`, `SaveButton`, `ShareButton`, `Button`, `Wordmark`, `Hatch`
