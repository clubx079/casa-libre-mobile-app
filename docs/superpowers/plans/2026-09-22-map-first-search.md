# Map-first Search Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Buscar tab into a map-first screen: full-screen Google map, listings in a 3-snap bottom sheet that always shows only the in-view listings, and a swipeable pin-preview carousel with a highlighted pin.

**Architecture:** React Native owns all state (filters, visible bounds, selection, sheet snap). The WebView map only renders and talks over the existing `postMessage` / `injectJavaScript` bridge. It is never reloaded on filter changes; pins are swapped in place. All filtering (including "inside the visible bounds") runs client-side on the full listing set, fetched once from a new slim server feed.

**Tech Stack:** Expo 57, RN 0.86, expo-router, react-native-reanimated 4.5, react-native-gesture-handler 2.32, react-native-webview + Google Maps JS + @googlemaps/markerclusterer 2.5.3. Next.js 14 buyer portal for the server feed. `node --test` for the pure helpers.

**Spec:** `docs/superpowers/specs/2026-09-22-map-first-search-design.md`

## Global Constraints

- Mobile app: local git only, never push.
- Buyer portal: local commit only, never push/deploy without explicit user instruction.
- PY production DB is read-only. The server change is a read path.
- **Keep the anti-scraping hardening:** the full (non-slim) mobile feed stays clamped at 600. Only a `slim=1` feed may return up to 5000, and it must NOT contain `contact_phone`, `contact_name`, `description`, `features`, `images[]` or `external_url`.
- No new native dependencies; `package.json` dependencies unchanged.
- Spanish-first copy via `lib/i18n.js` (es + en).
- Deviation from spec §3 (recorded): existing pins are already ink-filled, so the **selected** pin is the inverse (paper fill, ink text, ink border), 1.3×, with a shadow.
- Deviation from spec §4 (recorded): Buscar tab re-press is handled inside `index.js` via `navigation.addListener('tabPress')`; `_layout.js` is unchanged. Pull-to-refresh is dropped from the sheet list, because pulling down at the top now collapses the sheet.

---

### Task 1: Slim mobile feed (buyer portal)

**Files:**
- Modify: `casa-libre-BuyerPortal/lib/listings.js` (getListings select option + new cached `getMobileSlimListings`)
- Modify: `casa-libre-BuyerPortal/app/api/mobile/listings/route.js`

**Interfaces:**
- Produces: `GET /api/mobile/listings?slim=1&limit=5000[&mode=venta|alquiler]` → `{ rate, count, total, listings: SlimListing[] }` where SlimListing = `{ id, lat, lng, mode, usd, pyg, price, currency, type, city, neighborhood, province, address, beds, baths, parking, area, covered, lot, image, verified, plan, created_at }`.

- [ ] **Step 1:** In `getListings`, add `withImage = false` to the options and make the select `light ? LIGHT_SELECT + (withImage ? ',feature_image_url' : '') : SELECT`. `shape()` already falls back to `feature_image_url` for `image`.
- [ ] **Step 2:** Add a cached loader keyed per mode (revalidate 300s, tag `listings`):

```js
const slimForMobile = (l) => ({
  id: l.id, lat: l.lat, lng: l.lng, mode: l.mode, usd: l.usd, pyg: l.pyg, price: l.price, currency: l.currency,
  type: l.type, city: l.city, neighborhood: l.neighborhood, province: l.province, address: l.address,
  beds: l.beds, baths: l.baths, parking: l.parking, area: l.area, covered: l.covered, lot: l.lot,
  image: l.image, verified: l.verified, plan: l.plan, created_at: l.created_at,
});
export const getMobileSlimListings = unstable_cache(
  async (mode) => {
    const r = await getListings({ limit: 5000, light: true, withImage: true, mode });
    return { rate: r.rate, totalCount: r.totalCount, listings: r.listings.map(slimForMobile) };
  },
  ['cl-mobile-slim-listings-v1'],
  { revalidate: 300, tags: ['listings'] },
);
```

- [ ] **Step 3:** In the route: `if (url.searchParams.get('slim') === '1')` → `limit = Math.min(parsed || 5000, 5000)`, call `getMobileSlimListings(mode)`, return `{ rate, count, total: totalCount, listings }`. Otherwise keep the existing 600 clamp path unchanged.
- [ ] **Step 4:** Verify with `npx next build` or a local `node` import smoke test that the module parses. Then `git commit` locally. Do not push.

### Task 2: Pure map-filter helpers and slim fetch (mobile)

**Files:**
- Create: `lib/mapFilter.js`
- Create: `lib/__tests__/mapFilter.test.mjs`
- Modify: `lib/listings.js` (`fetchListings` → `slim=1`, default limit 5000)
- Modify: `package.json` (add `"test": "node --test lib/__tests__/"`)

**Interfaces:**
- Produces (all pure, no RN imports; `mapFilter.js` imports only `./geo.js`):
  - `norm(s) → string`, `TYPE_KEYS`, `TYPE_LABELS`, `typeKey(type) → string`
  - `hasCoords(l) → boolean`
  - `applyFilters(list, { q, typeF, bedF, priceF, mode, sort, nearMe, userLoc, radiusKm }) → Listing[]`: identical semantics to the old `filtered` memo in `index.js`.
  - `inBounds(l, b) → boolean`, where `b = { n, s, e, w }`, edges inclusive; handles `e < w` (antimeridian).
  - `filterInBounds(list, b) → Listing[]`: only listings with coordinates; `b == null` → all with coordinates.
  - `splitNoCoords(list) → { withCoords, noCoords }`
  - `sortByDistance(list, lat, lng) → Listing[]` (new array, nearest first)
  - `parseBoundsMsg(str) → { n, s, e, w, zoom } | null` for `"__bounds__:n,s,e,w,zoom"`

- [ ] **Step 1:** Write tests covering: bounds inclusion including exact edges and outside; `e < w` wrap; `filterInBounds` with null bounds and with no-coordinate listings excluded; `applyFilters` combining mode-rent price bands + type + beds + search text (accent-insensitive); near-me radius and ordering; `sortByDistance` order; `splitNoCoords` counts; `parseBoundsMsg` valid and invalid input.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `lib/mapFilter.js` by moving `norm`, `TYPE_KEYS`, `TYPE_LABELS`, `typeKey` and the filter/sort logic out of `index.js` verbatim, then adding the bounds/distance/split/parse helpers. Import `distanceKm`, `NEAR_RADIUS_KM` from `./geo.js`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** In `fetchListings`: `qs.set('slim','1')`, default `limit = 5000`. Commit.

### Task 3: WebView map protocol (`components/PropertyMap.js`)

**Interfaces:**
- Consumes: nothing from Task 2 (it posts raw strings; `index.js` parses them).
- Produces: `PropertyMap` becomes `forwardRef`. New props: `onMoving()`, `onBounds(msgString)`, `onMapTap()`, `onClusterTap()`, `selectedId`, `bottomInset` (px under the sheet, excluded from the reported bounds). Ref methods:
  - `fitTo(listings, { top, bottom })`
  - `flyTo({ latitude, longitude })`
  - `ensureVisible(lat, lng, topPx, bottomPx)`: pans without changing zoom, only if the point is outside the free area
  - `zoomOut()`

  The existing `single` mode (property page mini-map) and `onMarkerPress` behave as before.

- [ ] **Step 1:** HTML memo deps become `[single?.id, country.code]`. Browse-mode points are pushed with `window.__clSetPoints(points)` (queued in `window.__clPts` if the map isn't ready) from an effect keyed on a points key (joined ids), and again in `onLoadEnd`.
- [ ] **Step 2:** JS side:
  - Keep a `byId` marker registry.
  - `__clSetPoints` clears the clusterer and the promoted markers and rebuilds them, then re-applies the current selection.
  - `__clSelect(id|null)`: the previous pin reverts (icon, z-index, back into the clusterer if it isn't promoted). The new pin is removed from the clusterer, `setMap(map)`, gets the selected icon (1.3× paper pill, ink text, 2.5px ink stroke, shadow) and `zIndex 20000`.
  - `__clFitTo(pts, top, bottom)`: 0 points → no-op; 1 point → center + zoom 15; otherwise `fitBounds(bounds, {top, bottom, left: 40, right: 40})`.
  - `__clEnsureVisible(lat, lng, topPx, bottomPx)`: uses `getBounds()` and the div height, and does `panTo` + `panBy(0, (bottomPx - topPx) / 2)` when the point is outside.
  - `__clZoomOut()`: `setZoom(Math.floor(zoom) - 1)`.
  - `__clSetInsets(bottomPx)`
- [ ] **Step 3:** Events:
  - `bounds_changed` → post `__moving__` once per motion.
  - `idle` → post `__bounds__:n,s,e,w,zoom`, with `s` raised by the bottom inset fraction.
  - map `click` → `__map_tap__`.
  - Clusterer `onClusterClick` → `fitBounds(cluster.bounds)` + post `__cluster__`.
  - Remove the `__view__` / restore-view / near-off workaround.
- [ ] **Step 4:** RN `onMessage` routes these messages to the new props; any other string is a pin id → `onMarkerPress` or `router.push`. Remove the built-in locate button from browse mode (`index.js` renders its own, which follows the sheet). Export `NavTriangle` and `locateShadow`.
- [ ] **Step 5:** Commit.

### Task 4: `components/ListingsSheet.js`

**Interfaces:**
- Consumes: `PropertyCard`, theme, i18n.
- Produces: `export function sheetSnaps(H, topInset) → { full, half, collapsed }` (translateY values; `COLLAPSED_H = 76`, half = `H * 0.55`, full = `topInset`) and `export const COLLAPSED_H`. Default export `ListingsSheet` (forwardRef, ref: `snapTo(name)`) with props: `H`, `topInset`, `sheetY` (shared value owned by the parent), `onSnapChange(name)`, `header` (ReactNode, the full-state header rows), `status` (`'boot'|'error'|'moving'|'idle'`), `count`, `globalCount`, `onZoomOut`, `onClearFilters`, `onRetry`, `data` (listings), `noCoords` (listings), `listResetKey`.

- [ ] **Step 1:** `Animated.View` positioned absolutely, height `H - topInset`, `translateY = sheetY`. Initial position: collapsed.
- [ ] **Step 2:** The header area (grabber + collapsible full header + count row) sits under a `Gesture.Pan` that drives `sheetY`, clamped between full and collapsed. On end: `|vy| > 500` → next snap in that direction, else the nearest; `withSpring({ damping: 22, stiffness: 220, mass: 0.9 })`; `runOnJS(onSnapChange)`.
- [ ] **Step 3:** The full-header rows sit in a container whose height and opacity interpolate from `sheetY` between the half and full positions (measured via `onLayout`), so they only appear as the sheet reaches full.
- [ ] **Step 4:** The list is a reanimated `Animated.FlatList` (`bounces={false}`, `scrollEnabled` only at full, `PER_PAGE = 24` paging, `PropertyCard` rows). It's wrapped in `GestureDetector(Gesture.Native())`, and an outer `Gesture.Pan().simultaneousWithExternalGesture(native)` moves the sheet when: not full (any direction), or full with `scrollY <= 0` and dragging down (anchored at the translation where the top was reached).
- [ ] **Step 5:** Count row:
  - `boot`: spinner + `t('loadingProps')`
  - `moving`: spinner + `t('searchingArea')`, list opacity 0.4
  - `error`: `t('loadError')` + `t('retry')` button
  - `idle`: `"{count} {t('propsInArea')}"`; if `count === 0` and `globalCount > 0` → `t('zoomOut')` button; if `globalCount === 0` → `t('clearFilters')` button
- [ ] **Step 6:** List footer: when `noCoords.length` → a row `"+ {n} {t('noCoordsRow')} · {t('see')}"` that opens an RN `Modal` (pageSheet) listing them with `PropertyCard`. `listResetKey` changes → scroll to top.
- [ ] **Step 7:** Commit.

### Task 5: `components/PinPreview.js`

**Interfaces:**
- Produces: default `PinPreview({ items, more, bottom, onIndexChange(i), onOpen(listing), onSeeAll })`, plus `export const PREVIEW_H`.
- [ ] **Step 1:** Horizontal `FlatList`: card width = 90% of the screen, gap 10, `snapToInterval`, `decelerationRate="fast"`, side padding so the first card is centred and the next one peeks. `onMomentumScrollEnd` → index. Keyed by `items[0].id` so a new tap resets to 0. `entering={FadeInDown}` / `exiting={FadeOutDown}` via reanimated.
- [ ] **Step 2:** Card: 140px cover image (expo-image) or `Hatch`; `SaveButton` top-right; Verificada tag (same style as `PropertyCard`) bottom-left; price `fullUsd` + `/mes` for rent; `pyg` line; `metaLine` + `typeLabel`; `zoneLine`. Tap → `onOpen`.
- [ ] **Step 3:** When `more > 0`, append a final "Ver todas en la lista" card → `onSeeAll`. Commit.

### Task 6: Screen assembly (`app/(tabs)/index.js`) and i18n

**Interfaces:**
- Consumes: everything above.
- [ ] **Step 1:** i18n keys (es / en):
  - `loadingProps`: 'Cargando propiedades…' / 'Loading properties…'
  - `searchingArea`: 'Buscando en esta zona…' / 'Searching this area…'
  - `propsInArea`: 'propiedades en esta zona' / 'properties in this area'
  - `zoomOut`: 'Alejar mapa' / 'Zoom out'
  - `clearFilters`: 'Borrar filtros' / 'Clear filters'
  - `noCoordsRow`: 'sin ubicación en el mapa' / 'without a map location'
  - `see`: 'Ver' / 'See'
  - `loadError`: 'No se pudieron cargar las propiedades' / "Couldn't load properties"
  - `retry`: 'Reintentar' / 'Retry'
  - `seeAllInList`: 'Ver todas en la lista' / 'See all in the list'
  - `noCoordsTitle`: 'Sin ubicación en el mapa' / 'No map location'
- [ ] **Step 2:** Root is a `View` measuring `H` via `onLayout`, holding:
  - the full-screen `PropertyMap` with `bottomInset = COLLAPSED_H`
  - the floating search bar + filters button (top = safe inset + 8), fading out with `sheetY` (half → full)
  - the locate button following `sheetY - 60`, hidden at full and while a preview is open
  - `PinPreview`
  - `ListingsSheet`
  - the "Mapa" pill, visible when snap is full
  - the existing filters `BottomSheet`
- [ ] **Step 3:** State and logic:
  - `filtered = applyFilters(raw, …)`, `{ withCoords, noCoords } = splitNoCoords(filtered)`, `areaList = filterInBounds(filtered, bounds)`
  - The moving/idle status holds for at least 300 ms
  - Fit-on-filter-change runs when the filter key changes after a load (search debounced 400 ms): near-me → `flyTo(userLoc)`, else `fitTo(withCoords, { top: inset + 90, bottom: COLLAPSED_H + 30 })`
  - Pin tap → `preview = { items: [l, ...sortByDistance(areaList without l)].slice(0, 30), more }`, `idx = 0`, sheet collapses
  - `idx` change → `ensureVisible(item, inset + 80, COLLAPSED_H + PREVIEW_H + 24)`
  - Close the preview on: map tap, cluster tap, snap ≠ collapsed, filters open, search focus, filter-key change, Android back
  - `BackHandler`: preview → close; snap ≠ collapsed → collapse
  - `navigation.addListener('tabPress')` while focused → collapse + close the preview
  - The filters dialog's result button shows `withCoords.length + noCoords.length`
- [ ] **Step 4:** Commit.

### Task 7: Verification and QR

- [ ] `npm test` passes.
- [ ] Start Metro per the run notes (`EXPO_TOKEN=gsjob…`, `REACT_NATIVE_PACKAGER_HOSTNAME=<LAN IP>`, `npx expo start`), then fetch the iOS and Android bundle URLs with curl and confirm HTTP 200 with no `SyntaxError` / "Unable to resolve".
- [ ] Regenerate the QR PNG for `exp://<LAN IP>:8081` and open the existing scratchpad `expo-qr.html` page for the user.
- [ ] Update the `casa-libre-mobile-app` memory note.
