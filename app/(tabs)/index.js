// Buscar — map-first search (Zillow/Homes.com style).
//
// The map fills the screen with just a floating search bar + filters button. The
// listings live in a 3-snap bottom sheet (ListingsSheet) that always shows ONLY
// the listings inside the visible map area, after the filters. Tapping a pin opens
// a swipeable preview carousel (PinPreview); the pin of the card on screen is
// highlighted on the map. Searching / filtering / near-me first moves the map to
// fit the matches, then the list follows the map.
//
// All filtering is client-side over the full catalog (slim feed), so moving the map
// never hits the network — the brief "Buscando en esta zona…" state is feedback.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, BackHandler, Keyboard, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useFocusEffect, useNavigation, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useCountry } from '../../lib/country';
import { fetchListings } from '../../lib/listings';
import { getUserLocation } from '../../lib/geo';
import { applyFilters, splitNoCoords, filterInBounds, sortByDistance, parseBoundsMsg, TYPE_KEYS, TYPE_LABELS } from '../../lib/mapFilter';
import PropertyMap, { NavTriangle, locateShadow, LOCATE_INK } from '../../components/PropertyMap';
import ListingsSheet, { COLLAPSED_H, sheetSnaps } from '../../components/ListingsSheet';
import PinPreview, { PREVIEW_H } from '../../components/PinPreview';
import BottomSheet from '../../components/BottomSheet';

const PREVIEW_MAX = 30;
const MIN_LOADING_MS = 300;

// ── Dropdown (module-scope so it never remounts on parent re-render) ──────────
function Dropdown({ label, value, options, onSelect, open, onToggle }) {
  return (
    <View style={{ borderWidth: 1.5, borderColor: colors.ink12, borderRadius: radii.sm, marginBottom: 12, overflow: 'hidden' }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
        <View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink45, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink, marginTop: 2 }}>
            {options.find((o) => o.k === value)?.label || options[0]?.label}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.ink45} />
      </Pressable>
      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.ink08 }}>
          {options.map((o) => {
            const on = o.k === value;
            return (
              <Pressable key={o.k} onPress={() => onSelect(o.k)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: on ? colors.ink04 : 'transparent' }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}>{o.label}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={colors.ink} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// The ONE search field. The bar is rendered ABOVE the sheet and stays at the top
// of the screen, so as the sheet rises to full it simply lands on the sheet's own
// paper — the map's search bar and the list's search bar are the same control.
function SearchBox({ value, onChange, placeholder, onFocus, inputRef }) {
  return (
    <View style={{ flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.pill, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 }}>
      <Ionicons name="search" size={17} color={colors.ink45} />
      <TextInput ref={inputRef} value={value} onChangeText={onChange} onFocus={onFocus} placeholder={placeholder} placeholderTextColor={colors.ink45}
        style={{ flex: 1, paddingVertical: 8, marginLeft: 8, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }} returnKeyType="search" />
      {value ? <Pressable onPress={() => onChange('')} hitSlop={12}><Ionicons name="close-circle" size={18} color={colors.ink30} /></Pressable> : null}
    </View>
  );
}

function FiltersButton({ count, onPress }) {
  const on = !!count;
  return (
    <Pressable onPress={onPress} accessibilityLabel="Filtros" style={{ height: 48, minWidth: 48, paddingHorizontal: on ? 14 : 0, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? colors.ink : colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 }}>
      <Ionicons name="options-outline" size={20} color={on ? colors.paper : colors.ink} />
      {on ? <Text style={{ fontFamily: fonts.monoMed, fontSize: 13, color: colors.paper }}>{count}</Text> : null}
    </Pressable>
  );
}

export default function Marketplace() {
  const { t, lang } = useI18n();
  const { code } = useCountry();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const searchInputRef = useRef(null);

  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');           // debounced search (drives the fit-to-results)
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [sort, setSort] = useState('relevancia');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDD, setOpenDD] = useState(null);
  // "Near me" — the user's real device coords + a radius filter (mirrors the web).
  const [nearMe, setNearMe] = useState(false);
  const [userLoc, setUserLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  // Map ↔ list
  const [H, setH] = useState(0);
  const [bounds, setBounds] = useState(null);
  const [moving, setMoving] = useState(false);
  const [snap, setSnap] = useState('collapsed');
  const [preview, setPreview] = useState(null);  // { items, more } | null
  const [previewIdx, setPreviewIdx] = useState(0);

  const sheetY = useSharedValue(10000);
  const snaps = sheetSnaps(H, insets.top);
  const previewRef = useRef(null); previewRef.current = preview;
  const snapRef = useRef('collapsed'); snapRef.current = snap;

  // ── Data ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { listings } = await fetchListings({ mode: mode === 'all' ? undefined : mode });
      setRaw(listings);
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [mode, code]); // refetch against the active country's API when it changes

  useEffect(() => { load(); }, [load]);
  // Typing re-filters the catalogue AND rebuilds every map pin (a ~280 KB payload
  // that makes the WebView recreate thousands of markers), so that work waits for
  // a pause in typing — otherwise the keyboard and the clear button stutter.
  useEffect(() => { const id = setTimeout(() => setDq(q), 300); return () => clearTimeout(id); }, [q]);

  const requestLocation = useCallback(async () => {
    if (userLoc) return userLoc;
    setLocating(true);
    const loc = await getUserLocation();
    setLocating(false);
    if (loc) setUserLoc(loc);
    else Alert.alert(lang === 'en' ? "We couldn't access your location" : 'No pudimos acceder a tu ubicación');
    return loc;
  }, [userLoc, lang]);

  const toggleNearMe = useCallback(async () => {
    if (nearMe) { setNearMe(false); return; }
    const loc = userLoc || (await requestLocation());
    if (!loc) { setNearMe(false); return; }
    setNearMe(true);
  }, [nearMe, userLoc, requestLocation]);

  const filtered = useMemo(
    () => applyFilters(raw, { q: dq, typeF, bedF, priceF, mode, sort, nearMe, userLoc }),
    [raw, dq, typeF, bedF, priceF, sort, mode, nearMe, userLoc],
  );
  const { withCoords } = useMemo(() => splitNoCoords(filtered), [filtered]);
  const areaList = useMemo(() => filterInBounds(filtered, bounds), [filtered, bounds]);
  const byId = useMemo(() => new Map(raw.map((l) => [l.id, l])), [raw]);

  const status = loadError && !raw.length ? 'error'
    : loading && !raw.length ? 'boot'
    : moving || loading ? 'moving' : 'idle';

  const activeCount = (typeF !== 'all' ? 1 : 0) + (priceF !== 'all' ? 1 : 0) + (bedF !== 'all' ? 1 : 0) + (sort !== 'relevancia' ? 1 : 0);
  const clearFilters = () => { setTypeF('all'); setPriceF('all'); setBedF('all'); setSort('relevancia'); };
  const clearQuery = () => { setQ(''); setDq(''); };
  const clearAll = () => { clearFilters(); clearQuery(); setNearMe(false); };

  // ── Map motion → loading state → in-area list (held ≥300 ms so it doesn't flicker)
  const movingSince = useRef(0);
  const boundsTimer = useRef(null);
  const onMoving = useCallback(() => { movingSince.current = Date.now(); setMoving(true); }, []);
  const onBounds = useCallback((msg) => {
    const b = parseBoundsMsg(msg);
    if (!b) return;
    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - movingSince.current));
    clearTimeout(boundsTimer.current);
    boundsTimer.current = setTimeout(() => { setBounds(b); setMoving(false); }, wait);
  }, []);
  useEffect(() => () => clearTimeout(boundsTimer.current), []);

  const closePreview = useCallback(() => setPreview(null), []);

  // ── Search / filters / near-me changed → fit the map to the matches first.
  const filterKey = [dq, typeF, priceF, bedF, mode, nearMe ? 'near' : ''].join('|');
  const fittedKey = useRef(filterKey);
  useEffect(() => {
    if (loading || filterKey === fittedKey.current) return;
    fittedKey.current = filterKey;
    setPreview(null);
    if (nearMe && userLoc) { mapRef.current?.flyTo(userLoc); return; }
    if (withCoords.length) mapRef.current?.fitTo(withCoords, { top: insets.top + 90, bottom: COLLAPSED_H + 30 });
  }, [filterKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pin preview ──────────────────────────────────────────────────────────────
  const keepVisible = useCallback((l) => {
    if (l) mapRef.current?.ensureVisible(l.lat, l.lng, insets.top + 80, COLLAPSED_H + PREVIEW_H + 24);
  }, [insets.top]);

  const onMarkerPress = useCallback((id) => {
    const l = byId.get(id);
    if (!l) return;
    Keyboard.dismiss();
    const rest = sortByDistance(areaList.filter((x) => x.id !== id), Number(l.lat), Number(l.lng));
    setPreview({ items: [l, ...rest].slice(0, PREVIEW_MAX), more: Math.max(0, rest.length + 1 - PREVIEW_MAX) });
    setPreviewIdx(0);
    sheetRef.current?.snapTo('collapsed');
    keepVisible(l);
  }, [byId, areaList, keepVisible]);

  const onPreviewIndex = useCallback((i) => {
    setPreviewIdx(i);
    keepVisible(previewRef.current?.items[i]);
  }, [keepVisible]);

  const selectedId = preview ? preview.items[previewIdx]?.id ?? null : null;

  const onSnapChange = useCallback((name) => {
    setSnap(name);
    if (name !== 'collapsed') { setPreview(null); }
    if (name === 'collapsed') Keyboard.dismiss();
  }, []);

  // Android back: close the preview, then collapse the sheet, then default.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (previewRef.current) { setPreview(null); return true; }
      if (snapRef.current !== 'collapsed') { sheetRef.current?.snapTo('collapsed'); return true; }
      return false;
    });
    return () => sub.remove();
  }, []));

  // Re-tapping the Buscar tab while on it → back to the map.
  useEffect(() => navigation.addListener('tabPress', () => {
    if (navigation.isFocused()) { setPreview(null); sheetRef.current?.snapTo('collapsed'); }
  }), [navigation]);

  const openFilters = () => { setPreview(null); Keyboard.dismiss(); setFiltersOpen(true); };

  // ── Overlays that follow the sheet ───────────────────────────────────────────
  const locateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value - 60 }],
    opacity: interpolate(sheetY.value, [snaps.full, snaps.half], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Filter options ───────────────────────────────────────────────────────────
  const priceOpts = mode === 'alquiler'
    ? [{ k: 'all', label: t('anyPrice') }, { k: 'lo', label: '< US$ 500' }, { k: 'mid', label: 'US$ 500 – 1000' }, { k: 'hi', label: '> US$ 1000' }]
    : [{ k: 'all', label: t('anyPrice') }, { k: 'lo', label: '< US$ 100k' }, { k: 'mid', label: 'US$ 100k – 200k' }, { k: 'hi', label: '> US$ 200k' }];
  const typeOpts = TYPE_KEYS.map((k) => ({ k, label: k === 'all' ? t('anyType') : TYPE_LABELS[k] }));
  const bedOpts = [{ k: 'all', label: t('anyBeds') }, { k: '1', label: '1+' }, { k: '2', label: '2+' }, { k: '3', label: '3+' }];
  const sortOpts = [{ k: 'relevancia', label: t('sortRelevance') }, { k: 'precio_asc', label: t('sortPriceAsc') }, { k: 'precio_desc', label: t('sortPriceDesc') }, { k: 'area_desc', label: t('sortAreaDesc') }];

  const ModeChip = ({ k, label }) => {
    const on = mode === k;
    return (
      <Pressable onPress={() => setMode(k)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1.5, borderColor: on ? colors.ink : colors.ink30, backgroundColor: on ? colors.ink : colors.card, marginRight: 8 }}>
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: on ? colors.paper : colors.ink }}>{label}</Text>
      </Pressable>
    );
  };

  // Shown at the top of the sheet only when it's fully open: room for the search
  // bar that sits above it, then the mode chips. (The wordmark and the ES/EN
  // toggle live on the Account tab — no need to repeat them here.)
  const sheetHeader = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
      {/* clears the search bar above (bar: top+8, 48 tall) minus the grabber row */}
      <View style={{ height: 45 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
        <ModeChip k="all" label={t('all')} />
        <ModeChip k="venta" label={t('buy')} />
        <ModeChip k="alquiler" label={t('rent')} />
      </View>
    </View>
  );

  const listResetKey = `${bounds ? [bounds.n, bounds.s, bounds.e, bounds.w].join(',') : ''}|${filterKey}|${sort}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.hatch }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <PropertyMap
        ref={mapRef}
        listings={filtered}
        style={StyleSheet.absoluteFill}
        onMarkerPress={onMarkerPress}
        onMoving={onMoving}
        onBounds={onBounds}
        onMapTap={() => { closePreview(); Keyboard.dismiss(); }}
        onClusterTap={closePreview}
        selectedId={selectedId}
        bottomInset={COLLAPSED_H}
        userLocation={userLoc}
        nearMe={nearMe}
      />

      {/* Near-me toggle — rides just above the sheet's top edge. */}
      {H > 0 && !preview ? (
        <Animated.View pointerEvents={snap === 'full' ? 'none' : 'box-none'} style={[{ position: 'absolute', right: 16, top: 0 }, locateStyle]}>
          <Pressable
            onPress={toggleNearMe}
            accessibilityLabel={nearMe ? 'Near me (on)' : 'Near me'}
            hitSlop={8}
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
              borderWidth: nearMe ? 2 : 0, borderColor: colors.ink, ...locateShadow,
            }, pressed && { transform: [{ translateY: 1 }] }]}
          >
            {locating ? <ActivityIndicator size="small" color={LOCATE_INK} /> : <NavTriangle size={19} color={nearMe ? colors.ink : LOCATE_INK} />}
          </Pressable>
        </Animated.View>
      ) : null}

      {preview ? (
        <PinPreview
          items={preview.items}
          more={preview.more}
          bottom={COLLAPSED_H + 12}
          onIndexChange={onPreviewIndex}
          onOpen={(l) => router.push(`/property/${l.id}`)}
          onSeeAll={() => { setPreview(null); sheetRef.current?.snapTo('full'); }}
        />
      ) : null}

      {H > 0 ? (
        <ListingsSheet
          ref={sheetRef}
          H={H}
          topInset={insets.top}
          sheetY={sheetY}
          onSnapChange={onSnapChange}
          header={sheetHeader}
          status={status}
          count={areaList.length}
          globalCount={filtered.length}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onClearFilters={clearAll}
          onRetry={load}
          data={areaList}
          listResetKey={listResetKey}
        />
      ) : null}

      {/* Back to the map from the full list. */}
      {snap === 'full' ? (
        <Pressable
          onPress={() => sheetRef.current?.snapTo('collapsed')}
          style={{ position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: 22, ...hardShadow }}
        >
          <Ionicons name="map" size={18} color={colors.paper} />
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.paper }}>{t('map')}</Text>
        </Pressable>
      ) : null}

      {/* The single search + filters bar. Drawn above the sheet so it stays put at
          the top of the screen: on the map it floats, and when the sheet reaches
          full it is sitting on the sheet's own header. */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SearchBox value={q} onChange={setQ} placeholder={t('searchPlaceholder')} onFocus={closePreview} inputRef={searchInputRef} />
        <FiltersButton count={activeCount} onPress={openFilters} />
      </View>

      {/* Filters popup */}
      <BottomSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{t('filters')}</Text>
          <Pressable onPress={() => setFiltersOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
        </View>
        <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 8 }}>
          <Dropdown label={t('type')} value={typeF} options={typeOpts} onSelect={(k) => { setTypeF(k); setOpenDD(null); }} open={openDD === 'type'} onToggle={() => setOpenDD(openDD === 'type' ? null : 'type')} />
          <Dropdown label={t('price')} value={priceF} options={priceOpts} onSelect={(k) => { setPriceF(k); setOpenDD(null); }} open={openDD === 'price'} onToggle={() => setOpenDD(openDD === 'price' ? null : 'price')} />
          <Dropdown label={t('beds')} value={bedF} options={bedOpts} onSelect={(k) => { setBedF(k); setOpenDD(null); }} open={openDD === 'beds'} onToggle={() => setOpenDD(openDD === 'beds' ? null : 'beds')} />
          <Dropdown label={t('sort')} value={sort} options={sortOpts} onSelect={(k) => { setSort(k); setOpenDD(null); }} open={openDD === 'sort'} onToggle={() => setOpenDD(openDD === 'sort' ? null : 'sort')} />
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.ink08 }}>
          <Pressable onPress={clearFilters} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink }}>
            <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink }}>{t('clear')}</Text>
          </Pressable>
          <Pressable onPress={() => setFiltersOpen(false)} style={{ flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.ink, ...hardShadow }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper }}>{filtered.length.toLocaleString('es-PY')} {t('results')}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}
