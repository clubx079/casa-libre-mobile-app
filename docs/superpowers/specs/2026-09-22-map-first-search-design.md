# Map-first search screen — design

**Date:** 2026-09-22 · **App:** casa-libre-mobile-app (Expo / RN 0.86) · **Status:** approved in chat, pending spec review

## Goal

Replace the list-first Buscar tab with a Zillow/Homes.com-style map-first screen:
full-screen map by default, listings in a draggable bottom sheet, a swipeable pin
preview carousel, and a list that always shows only the listings inside the
visible map area.

## Decisions (from brainstorming)

- Map is the default view; only the search bar + filters button float on it.
- Wordmark + ES/EN toggle are hidden on the map; they appear in the sheet header when fully open.
- Search / filter / near-me change → map first fits to the matching listings, then the list follows the map.
- Load **all** listings: raise the server cap 600 → 5000 (buyer-portal one-liner, local commit, not deployed until the user says so).
- Filter changes no longer reload the map WebView — pins are swapped in place.
- Listings without coordinates are excluded from the area list; a "+ N sin ubicación en el mapa · Ver" row at the end of the list opens them.
- Architecture: **React Native owns state; the WebView map only renders** (Approach 1). No switch to react-native-maps; no carousel in HTML.
- Visible loading sign while the map moves, then the in-area count.

## 1. Data flow and map-move behaviour

1. **Boot:** `fetchListings({ limit: 5000 })` once. Sheet shows the mascot loader + "Cargando propiedades…".
2. **Map moving** (pan / pinch / double-tap-drag): WebView posts `__moving__` on the first movement. Sheet header shows a spinner + "Buscando en esta zona…"; the list dims to 40 % (not cleared).
3. **Map idle:** WebView posts `__bounds__:n,s,e,w,zoom`. RN computes
   `inArea = applyFilters(all) ∩ inBounds(bounds)` (filters = mode, type, price, beds, search text, near-me radius).
   Header shows "**N propiedades en esta zona**", list un-dims and scrolls to top. The loading state is held ≥ ~300 ms to avoid a flicker.
4. **Search / filter / near-me change:** RN sends `fitTo(matching)` (near-me: `flyTo(user)`); the resulting idle runs step 3. If 0 listings match globally the map stays put and the header reads "0 propiedades · Borrar filtros".
5. **Zero in area:** header "0 propiedades en esta zona" + an "Alejar mapa" button that zooms out one level per press until results appear.
6. **No coordinates:** excluded from `inArea`; the last list row is "+ N sin ubicación en el mapa · Ver" → opens a plain list of those listings (filters still applied).
7. **Boot fetch fails:** sheet shows "No se pudieron cargar las propiedades · Reintentar"; map remains usable with no pins.

## 2. Bottom sheet (`components/ListingsSheet.js`)

- Snap points: **collapsed** (~88 px above the tab bar: grabber + count line), **half** (~45 % of screen), **full** (top at the safe-area inset).
- Default on open: collapsed.
- Drag by grabber/header; a fling moves one snap in its direction, a slow release snaps to nearest. Built on the already-installed `react-native-gesture-handler` + `react-native-reanimated` (no new dependency).
- List scrolls only at full. At full with the list at offset 0, a downward pull drags the sheet. At half, an upward drag expands to full instead of scrolling.
- **Full header (sticky):** row 1 Wordmark + ES/EN · row 2 search input + filters button · row 3 Todas / Comprar / Alquilar chips · row 4 count line. The floating map search bar cross-fades out as the sheet rises; both inputs bind to the same `q` state.
- **Collapsed / half header:** grabber + count line (or the loading state from §1).
- **"Mapa" pill:** visible only at full; tap → collapsed.
- Map controls (locate / near-me) track the sheet's top edge; hidden at full.
- Android back: preview open → close preview; sheet above collapsed → collapse; otherwise default.
- Re-tapping the Buscar tab while focused → collapse the sheet.

## 3. Pin preview carousel (`components/PinPreview.js`)

- Pin tap → sheet collapses (if needed) and a horizontal paging carousel appears above the sheet.
- Card (~90 % screen width, next card peeks): cover photo + Verificada tag, save heart, US$ price with ₲ below, beds · baths · m² · type, neighbourhood · city. Reuses existing card sub-parts / `SaveButton`.
- Carousel items: the tapped listing first, then other **in-area** listings sorted by distance from it; max 30, then a final "Ver todas en la lista" card that opens the sheet to full.
- **Highlighted pin:** the current card's pin renders ~1.3×, inverted (ink fill, paper text), drop shadow, top z-index; the previous pin reverts. If the selected listing is clustered, it is lifted out of the cluster while selected.
- Swiping to a listing whose pin is off-screen or under the carousel → map pans (no zoom change) so the pin sits above the cards.
- Card tap → `/property/[id]`; returning keeps the carousel on the same card.
- Close on: empty-map tap, sheet dragged up, filters/search opened, Android back. Pin reverts.
- Map moves while the carousel is open: carousel content is frozen (the area list still updates behind it); off-screen selection does not auto-close.
- Cluster tap → zoom in (existing behaviour) and close any open carousel.
- Filter change while the carousel is open → close it.

## 4. Implementation and scope

### WebView ↔ RN protocol (`components/PropertyMap.js`)

WebView → RN: `__moving__`, `__bounds__:n,s,e,w,zoom`, `<id>` (pin tap, existing), `__map_tap__` (empty-map tap; the existing `__near_off__` behaviour is preserved).

RN → WebView (`injectJavaScript`):

| Call | Purpose |
|---|---|
| `__clSetPoints(points)` | Replace markers + re-cluster, keep camera |
| `__clFitTo(points)` | Fit bounds to a set |
| `__clSelect(id \| null)` | Highlight / unhighlight a pin (lift out of cluster) |
| `__clPanTo(lat, lng, offsetPx)` | Pan without zoom, pin above the carousel |
| `__clZoomOut()` | One zoom level out ("Alejar mapa") |

The HTML is rebuilt only when the country changes (`useMemo` deps reduced to `country.code`, `single?.id`). This replaces the near-me save/restore-view-on-reload workaround.

### Files

| File | Change |
|---|---|
| `app/(tabs)/index.js` | Rewritten: full-screen map + floating search/filters + `ListingsSheet` + `PinPreview`; filter logic moved out |
| `components/ListingsSheet.js` | **New** — snap sheet, header, loading/count, list, Mapa pill |
| `components/PinPreview.js` | **New** — carousel |
| `lib/mapFilter.js` | **New** — pure: `applyFilters`, `inBounds`, `sortByDistance`, `splitNoCoords` |
| `components/PropertyMap.js` | Protocol above, selected-pin style, `__moving__`, no reload on filter change |
| `lib/listings.js` | Default `limit` 600 → 5000 |
| `app/(tabs)/_layout.js` | Buscar tab re-press → collapse sheet |
| `casa-libre-BuyerPortal/app/api/mobile/listings/route.js` | Cap 600 → 5000. **Local commit only; deploy (both orgs) only on explicit user instruction.** Until then the app receives 600. |

Unchanged: property page, Saved, Publish, Account, the database, web pages. `BottomSheet.js` (modal sheet for filters) stays as is.

### Constraints

- Mobile app: local git only, never pushed.
- PY production DB: read-only. The server change is a read-path cap only.
- No new native dependencies.

### Testing

- **Unit (vitest or plain node assert, whichever the repo supports):** `lib/mapFilter.js` — bounds inclusion including edges, filter combinations, distance ordering, no-coords split.
- **Device (Expo Go, standard EXPO_TOKEN start):** boot load; pan/zoom → loading → count; search/filter → fit; near-me; zero-in-area → Alejar mapa; three snaps + fling + scroll handoff; Mapa pill; pin → carousel → swipe → highlight + pan; clustered selection; card → property → back; Android back; sin-ubicación row; country switch (BO).
