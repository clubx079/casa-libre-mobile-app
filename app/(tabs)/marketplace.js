import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, RefreshControl, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { fetchListings } from '../../lib/listings';
import { typeKeyOf } from '../../lib/display';
import PropertyCard from '../../components/PropertyCard';
import PropertyMap from '../../components/PropertyMap';
import Wordmark from '../../components/Wordmark';

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PER_PAGE = 24;

// Local copy for the marketplace-specific strings (kept here so this screen can
// match the web wording exactly without threading every label through i18n).
const TXT = {
  es: { forSale: 'En venta', forRent: 'En alquiler', filters: 'Filtros', type: 'Tipo', price: 'Precio', beds: 'Dorm.', list: 'Lista', map: 'Mapa', relevance: 'Relevancia', listForFree: 'Publicar gratis', searchPh: 'Barrio, ciudad o edificio…', listings: 'anuncios', propertyType: 'Tipo de propiedad', priceUsd: 'Precio · US$', bedrooms: 'Dormitorios', barrio: 'Barrio', listedBy: 'Publicado por', ownerDirect: 'Dueño directo', agent: 'Inmobiliaria', clearAll: 'Limpiar todo', show: 'Ver', close: 'Cerrar', sortBy: 'Ordenar por', noResults: 'Sin resultados' },
  en: { forSale: 'For sale', forRent: 'For rent', filters: 'Filters', type: 'Type', price: 'Price', beds: 'Beds', list: 'List', map: 'Map', relevance: 'Relevance', listForFree: 'List for free', searchPh: 'Neighborhood, city or building…', listings: 'listings', propertyType: 'Property type', priceUsd: 'Price · US$', bedrooms: 'Bedrooms', barrio: 'Barrio', listedBy: 'Listed by', ownerDirect: 'Owner direct', agent: 'Agent', clearAll: 'Clear all', show: 'Show', close: 'Close', sortBy: 'Sort by', noResults: 'No results' },
};

const TYPE_PILLS = [
  { k: 'depto', es: 'Departamento', en: 'Apartment' }, { k: 'casa', es: 'Casa', en: 'House' },
  { k: 'duplex', es: 'Dúplex', en: 'Duplex' }, { k: 'terreno', es: 'Terreno', en: 'Land' },
  { k: 'oficina', es: 'Oficina', en: 'Office' }, { k: 'deposito', es: 'Depósito', en: 'Warehouse' },
];
const typeKeyLabel = (k, lang) => { const o = TYPE_PILLS.find((x) => x.k === k); return o ? o[lang === 'en' ? 'en' : 'es'] : ''; };

const priceBuckets = (mode, lang) => mode === 'alquiler'
  ? [{ k: 'p1', l: lang === 'en' ? 'Under $500' : 'Menos de $500', t: (v) => v < 500 },
     { k: 'p2', l: '$500 – 1,000', t: (v) => v >= 500 && v <= 1000 },
     { k: 'p3', l: '$1,000 – 2,000', t: (v) => v > 1000 && v <= 2000 },
     { k: 'p4', l: '$2,000+', t: (v) => v > 2000 }]
  : [{ k: 'p1', l: lang === 'en' ? 'Under 80k' : 'Menos de 80k', t: (v) => v < 80000 },
     { k: 'p2', l: '80k – 200k', t: (v) => v >= 80000 && v <= 200000 },
     { k: 'p3', l: '200k – 400k', t: (v) => v > 200000 && v <= 400000 },
     { k: 'p4', l: '400k+', t: (v) => v > 400000 }];

const SORTS = [
  { k: 'relevancia', es: 'Relevancia', en: 'Relevance', esS: 'Relevancia', enS: 'Relevance' },
  { k: 'precio_asc', es: 'Precio: menor a mayor', en: 'Price: low to high', esS: 'Precio ↑', enS: 'Price ↑' },
  { k: 'precio_desc', es: 'Precio: mayor a menor', en: 'Price: high to low', esS: 'Precio ↓', enS: 'Price ↓' },
  { k: 'area_desc', es: 'Superficie: mayor primero', en: 'Area: largest first', esS: 'Mayor', enS: 'Largest' },
];

// A selectable filter pill (used across the bottom-sheet sections).
function FPill({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 1.5, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.ink30 }}>
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: on ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
function SectionLabel({ children }) {
  return <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.ink45, marginBottom: 10, marginTop: 22 }}>{children.toUpperCase()}</Text>;
}

export default function Marketplace() {
  const { lang, setLang } = useI18n();
  const T = TXT[lang];
  const params = useLocalSearchParams(); // { mode, q } passed from the home page
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState(params.mode === 'alquiler' ? 'alquiler' : 'venta');
  const [q, setQ] = useState(typeof params.q === 'string' ? params.q : '');

  // Re-sync when the home page navigates here with new params (tab stays mounted).
  useEffect(() => { if (params.mode === 'venta' || params.mode === 'alquiler') setMode(params.mode); }, [params.mode]);
  useEffect(() => { if (typeof params.q === 'string') setQ(params.q); }, [params.q]);
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [barrioF, setBarrioF] = useState('all');
  const [sellerF, setSellerF] = useState('all');
  const [sort, setSort] = useState('relevancia');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { listings } = await fetchListings({ mode, limit: 600 });
      setRaw(listings);
    } catch { setRaw([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [mode]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  const barrios = useMemo(() => {
    const m = {};
    raw.forEach((l) => { const nb = (l.neighborhood || '').trim(); if (nb) m[nb] = (m[nb] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([nb]) => nb);
  }, [raw]);

  const buckets = priceBuckets(mode, lang);
  const filtered = useMemo(() => {
    let out = raw;
    if (q.trim()) { const nq = norm(q); out = out.filter((l) => [l.neighborhood, l.city, l.address, l.type].some((f) => norm(f).includes(nq))); }
    if (typeF !== 'all') out = out.filter((l) => typeKeyOf(l.type) === typeF);
    if (bedF !== 'all') { const mn = Number(bedF); out = out.filter((l) => (l.beds || 0) >= mn); }
    if (barrioF !== 'all') out = out.filter((l) => norm(l.neighborhood) === norm(barrioF));
    if (sellerF !== 'all') out = out.filter((l) => (sellerF === 'owner' ? !!l.user_published : !l.user_published));
    if (priceF !== 'all') { const b = buckets.find((x) => x.k === priceF); if (b) out = out.filter((l) => b.t(l.usd || 0)); }
    const usdVal = (l) => l.usd ?? (l.pyg ? l.pyg / 7500 : 0);
    if (sort === 'precio_asc') out = [...out].sort((a, b) => usdVal(a) - usdVal(b));
    else if (sort === 'precio_desc') out = [...out].sort((a, b) => usdVal(b) - usdVal(a));
    else if (sort === 'area_desc') out = [...out].sort((a, b) => (b.covered || b.area || 0) - (a.covered || a.area || 0));
    return out;
  }, [raw, q, typeF, bedF, barrioF, sellerF, priceF, sort, mode, lang]);

  const isFiltered = typeF !== 'all' || priceF !== 'all' || bedF !== 'all' || barrioF !== 'all' || sellerF !== 'all' || !!q.trim();
  const activeCount = (typeF !== 'all' ? 1 : 0) + (priceF !== 'all' ? 1 : 0) + (bedF !== 'all' ? 1 : 0) + (barrioF !== 'all' ? 1 : 0) + (sellerF !== 'all' ? 1 : 0);
  useEffect(() => { setPage(1); }, [q, typeF, priceF, bedF, barrioF, sellerF, sort, mode]);
  const visible = filtered.slice(0, page * PER_PAGE);
  const clearAll = () => { setTypeF('all'); setPriceF('all'); setBedF('all'); setBarrioF('all'); setSellerF('all'); };
  const nfmt = (x) => x.toLocaleString(lang === 'en' ? 'en-US' : 'es-PY');
  const sortLabel = (SORTS.find((s) => s.k === sort) || SORTS[0])[lang === 'en' ? 'enS' : 'esS'];

  // ── Quick pill in the filter row (opens the sheet) ──
  const QuickPill = ({ label, active }) => (
    <Pressable onPress={() => setFiltersOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: active ? colors.ink : colors.ink30, backgroundColor: active ? colors.ink : colors.card, borderRadius: radii.pill, paddingLeft: 16, paddingRight: 12, height: 40 }}>
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: active ? colors.paper : colors.ink }}>{label}</Text>
      <Ionicons name="chevron-down" size={15} color={active ? colors.paper : colors.ink60} />
    </Pressable>
  );

  const Seg = ({ options, value, onChange }) => (
    <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, padding: 4 }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: radii.pill, backgroundColor: on ? colors.ink : 'transparent' }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: on ? colors.paper : colors.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Wordmark size={22} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
            {['ES', 'EN'].map((Lb) => {
              const on = (Lb === 'ES') === (lang === 'es');
              return <Text key={Lb} style={{ paddingHorizontal: 12, paddingVertical: 6, fontFamily: fonts.monoMed, fontSize: 12, color: on ? colors.paper : colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>{Lb}</Text>;
            })}
          </Pressable>
          <Pressable onPress={() => router.push('/publish')} style={{ backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.paper }}>{T.listForFree}</Text>
          </Pressable>
        </View>
      </View>

      {/* SEARCH */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink12, borderRadius: radii.pill, paddingLeft: 18, paddingRight: 5, height: 54 }}>
          <TextInput value={q} onChangeText={setQ} placeholder={T.searchPh} placeholderTextColor={colors.ink45} returnKeyType="search"
            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8} style={{ marginRight: 6 }}><Ionicons name="close-circle" size={18} color={colors.ink30} /></Pressable> : null}
          <View style={{ width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={20} color={colors.paper} />
          </View>
        </View>
      </View>

      {/* FOR SALE / FOR RENT */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Seg options={[{ k: 'venta', label: T.forSale }, { k: 'alquiler', label: T.forRent }]} value={mode} onChange={setMode} />
      </View>

      {/* FILTER ROW */}
      <View style={{ paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <Pressable onPress={() => setFiltersOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: activeCount ? colors.ink : colors.ink30, backgroundColor: activeCount ? colors.ink : colors.card, borderRadius: radii.pill, paddingLeft: 16, paddingRight: activeCount ? 8 : 16, height: 40 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: activeCount ? colors.paper : colors.ink }}>{T.filters}</Text>
            {activeCount ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: colors.ink }}>{activeCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <QuickPill label={typeF !== 'all' ? typeKeyLabel(typeF, lang) : T.type} active={typeF !== 'all'} />
          <QuickPill label={priceF !== 'all' ? (buckets.find((b) => b.k === priceF)?.l || T.price) : T.price} active={priceF !== 'all'} />
          <QuickPill label={bedF !== 'all' ? `${bedF}+` : T.beds} active={bedF !== 'all'} />
        </ScrollView>
      </View>

      {/* RESULTS ROW — count fixed left; controls right-aligned and horizontally
          scrollable so a long sort label can never collide with the toggle. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink60, flexShrink: 0 }}>{nfmt(filtered.length)} {T.listings}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 10, alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end' }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.ink, borderRadius: radii.pill, padding: 3 }}>
            {[['list', T.list], ['map', T.map]].map(([k, lb]) => {
              const on = view === k;
              return (
                <Pressable key={k} onPress={() => setView(k)} style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: on ? colors.paper : 'transparent' }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: on ? colors.ink : colors.paper }}>{lb}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.ink30, borderRadius: radii.pill, paddingHorizontal: 14, height: 36 }}>
            <Text style={{ fontFamily: fonts.sansMed, fontSize: 13, color: colors.ink }}>{sortLabel}</Text>
            <Ionicons name="swap-vertical" size={15} color={colors.ink60} />
          </Pressable>
        </ScrollView>
      </View>

      {/* BODY */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></View>
      ) : view === 'map' ? (
        <View style={{ flex: 1 }}>
          <PropertyMap listings={filtered} isFiltered={isFiltered} style={{ flex: 1 }} />
          <Pressable onPress={() => setView('list')} style={{ position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: 22, ...hardShadow }}>
            <Ionicons name="list" size={18} color={colors.paper} />
            <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.paper }}>{T.list}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PropertyCard listing={item} />}
          ListEmptyComponent={<Text style={{ fontFamily: fonts.sans, color: colors.ink60, textAlign: 'center', marginTop: 40 }}>{T.noResults}</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (visible.length < filtered.length) setPage((p) => p + 1); }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ink} />}
        />
      )}

      {/* SORT MENU */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable onPress={() => setSortOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.4)', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ backgroundColor: colors.paper, borderRadius: 18, borderWidth: 1.5, borderColor: colors.ink, overflow: 'hidden' }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.ink45, padding: 16, paddingBottom: 8 }}>{T.sortBy.toUpperCase()}</Text>
            {SORTS.map((s) => {
              const on = s.k === sort;
              return (
                <Pressable key={s.k} onPress={() => { setSort(s.k); setSortOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, backgroundColor: on ? colors.ink04 : 'transparent' }}>
                  <Text style={{ fontFamily: on ? fonts.sansBold : fonts.sans, fontSize: 15, color: colors.ink }}>{s[lang === 'en' ? 'en' : 'es']}</Text>
                  {on ? <Ionicons name="checkmark" size={18} color={colors.ink} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* FILTERS BOTTOM SHEET */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingTop: 8 }}>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}><View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.ink12 }} /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink }}>{T.filters}</Text>
              <Pressable onPress={() => setFiltersOpen(false)} style={{ borderWidth: 1.5, borderColor: colors.ink30, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 8 }}>
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>{T.close}</Text>
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 12 }}>
              <SectionLabel>{T.propertyType}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {TYPE_PILLS.map((tp) => <FPill key={tp.k} label={tp[lang === 'en' ? 'en' : 'es']} on={typeF === tp.k} onPress={() => setTypeF(typeF === tp.k ? 'all' : tp.k)} />)}
              </View>

              <SectionLabel>{T.priceUsd}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {buckets.map((b) => <FPill key={b.k} label={b.l} on={priceF === b.k} onPress={() => setPriceF(priceF === b.k ? 'all' : b.k)} />)}
              </View>

              <SectionLabel>{T.bedrooms}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {['1', '2', '3', '4'].map((b) => <FPill key={b} label={`${b}+`} on={bedF === b} onPress={() => setBedF(bedF === b ? 'all' : b)} />)}
              </View>

              {barrios.length ? (
                <>
                  <SectionLabel>{T.barrio}</SectionLabel>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {barrios.map((nb) => <FPill key={nb} label={nb} on={barrioF === nb} onPress={() => setBarrioF(barrioF === nb ? 'all' : nb)} />)}
                  </View>
                </>
              ) : null}

              <SectionLabel>{T.listedBy}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <FPill label={T.ownerDirect} on={sellerF === 'owner'} onPress={() => setSellerF(sellerF === 'owner' ? 'all' : 'owner')} />
                <FPill label={T.agent} on={sellerF === 'agent'} onPress={() => setSellerF(sellerF === 'agent' ? 'all' : 'agent')} />
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.ink08 }}>
              <Pressable onPress={clearAll} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink }}>
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink }}>{T.clearAll}</Text>
              </Pressable>
              <Pressable onPress={() => setFiltersOpen(false)} style={{ flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.ink, ...hardShadow }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper }}>{T.show} {nfmt(filtered.length)} {T.listings}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
