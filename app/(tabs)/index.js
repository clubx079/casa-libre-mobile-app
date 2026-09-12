import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, RefreshControl, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { fetchListings } from '../../lib/listings';
import { title, typeLabel } from '../../lib/display';
import PropertyCard from '../../components/PropertyCard';
import PropertyMap from '../../components/PropertyMap';
import Wordmark from '../../components/Wordmark';
import MascotLoader from '../../components/MascotLoader';

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TYPE_KEYS = ['all', 'casa', 'depto', 'duplex', 'comercial', 'oficina', 'deposito', 'edificio', 'condominio', 'otro'];
const TYPE_LABELS = { all: 'Todos', casa: 'Casa', depto: 'Departamento', duplex: 'Dúplex', comercial: 'Comercial', oficina: 'Oficina', deposito: 'Depósito', edificio: 'Edificio', condominio: 'Condominio', otro: 'Otro' };
function typeKey(t) {
  const s = norm(t);
  if (/departamento|depto|apartment/.test(s)) return 'depto';
  if (/duplex/.test(s)) return 'duplex';
  if (/casa|house/.test(s)) return 'casa';
  if (/comercial|local|tienda|negoc/.test(s)) return 'comercial';
  if (/oficina|office/.test(s)) return 'oficina';
  if (/deposito|dep.sito|galp/.test(s)) return 'deposito';
  if (/edificio|building/.test(s)) return 'edificio';
  if (/condominio|condo/.test(s)) return 'condominio';
  return 'otro';
}
const PER_PAGE = 24;

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

export default function Marketplace() {
  const { t, lang, setLang } = useI18n();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [sort, setSort] = useState('relevancia');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDD, setOpenDD] = useState(null); // which dropdown is expanded

  const load = useCallback(async () => {
    try {
      const { listings } = await fetchListings({ mode: mode === 'all' ? undefined : mode, limit: 600 });
      setRaw(listings);
    } catch { setRaw([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [mode]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const filtered = useMemo(() => {
    let out = raw;
    if (q.trim()) {
      const nq = norm(q);
      out = out.filter((l) => [l.neighborhood, l.city, l.address, l.type, typeLabel(l)].some((f) => norm(f).includes(nq)));
    }
    if (typeF !== 'all') out = out.filter((l) => typeKey(l.type) === typeF);
    if (bedF !== 'all') { const m = Number(bedF); out = out.filter((l) => (l.beds || 0) >= m); }
    if (priceF !== 'all') {
      out = out.filter((l) => {
        const v = l.usd || 0;
        if (mode === 'alquiler') return priceF === 'lo' ? v < 500 : priceF === 'mid' ? v >= 500 && v <= 1000 : v > 1000;
        return priceF === 'lo' ? v < 100000 : priceF === 'mid' ? v >= 100000 && v <= 200000 : v > 200000;
      });
    }
    const usdVal = (l) => l.usd ?? (l.pyg ? l.pyg / 7500 : 0);
    if (sort === 'precio_asc') out = [...out].sort((a, b) => usdVal(a) - usdVal(b));
    else if (sort === 'precio_desc') out = [...out].sort((a, b) => usdVal(b) - usdVal(a));
    else if (sort === 'area_desc') out = [...out].sort((a, b) => (b.covered || b.area || 0) - (a.covered || a.area || 0));
    return out;
  }, [raw, q, typeF, bedF, priceF, sort, mode]);

  const isFiltered = typeF !== 'all' || priceF !== 'all' || bedF !== 'all' || !!q.trim();
  const activeCount = (typeF !== 'all' ? 1 : 0) + (priceF !== 'all' ? 1 : 0) + (bedF !== 'all' ? 1 : 0) + (sort !== 'relevancia' ? 1 : 0);

  useEffect(() => { setPage(1); }, [q, typeF, priceF, bedF, sort, mode]);
  const visible = filtered.slice(0, page * PER_PAGE);

  const priceOpts = mode === 'alquiler'
    ? [{ k: 'all', label: t('anyPrice') }, { k: 'lo', label: '< US$ 500' }, { k: 'mid', label: 'US$ 500 – 1000' }, { k: 'hi', label: '> US$ 1000' }]
    : [{ k: 'all', label: t('anyPrice') }, { k: 'lo', label: '< US$ 100k' }, { k: 'mid', label: 'US$ 100k – 200k' }, { k: 'hi', label: '> US$ 200k' }];
  const typeOpts = TYPE_KEYS.map((k) => ({ k, label: k === 'all' ? t('anyType') : TYPE_LABELS[k] }));
  const bedOpts = [{ k: 'all', label: t('anyBeds') }, { k: '1', label: '1+' }, { k: '2', label: '2+' }, { k: '3', label: '3+' }];
  const sortOpts = [{ k: 'relevancia', label: t('sortRelevance') }, { k: 'precio_asc', label: t('sortPriceAsc') }, { k: 'precio_desc', label: t('sortPriceDesc') }, { k: 'area_desc', label: t('sortAreaDesc') }];

  const clearFilters = () => { setTypeF('all'); setPriceF('all'); setBedF('all'); setSort('relevancia'); };

  const ModeChip = ({ k, label }) => {
    const on = mode === k;
    return (
      <Pressable onPress={() => setMode(k)} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: on ? colors.ink : colors.ink30, backgroundColor: on ? colors.ink : colors.card, marginRight: 8 }}>
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: on ? colors.paper : colors.ink }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Wordmark size={20} />
        <Pressable onPress={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
          {['ES', 'EN'].map((L) => {
            const on = (L === 'ES') === (lang === 'es');
            return <Text key={L} style={{ paddingHorizontal: 12, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 12, color: on ? colors.paper : colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>{L}</Text>;
          })}
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10 }}>
        <ModeChip k="all" label={t('all')} />
        <ModeChip k="venta" label={t('buy')} />
        <ModeChip k="alquiler" label={t('rent')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink12, borderRadius: radii.pill, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={16} color={colors.ink45} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('searchPlaceholder')} placeholderTextColor={colors.ink45}
            style={{ flex: 1, paddingVertical: 10, marginLeft: 8, fontFamily: fonts.sans, color: colors.ink }} returnKeyType="search" />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.ink30} /></Pressable> : null}
        </View>
        <Pressable onPress={() => setFiltersOpen(true)} style={{ height: 44, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: activeCount ? colors.ink : colors.card }}>
          <Ionicons name="options-outline" size={18} color={activeCount ? colors.paper : colors.ink} />
          {activeCount ? <Text style={{ fontFamily: fonts.monoMed, fontSize: 13, color: colors.paper }}>{activeCount}</Text> : null}
        </Pressable>
        <Pressable onPress={() => setView(view === 'list' ? 'map' : 'list')} style={{ width: 44, height: 44, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
          <Ionicons name={view === 'list' ? 'map-outline' : 'list-outline'} size={20} color={colors.ink} />
        </Pressable>
      </View>

      {loading ? (
        <MascotLoader />
      ) : view === 'map' ? (
        <View style={{ flex: 1 }}>
          <PropertyMap listings={filtered} isFiltered={isFiltered} style={{ flex: 1 }} />
          <Pressable
            onPress={() => setView('list')}
            style={{ position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: 22, ...hardShadow }}
          >
            <Ionicons name="list" size={18} color={colors.paper} />
            <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.paper }}>{t('list')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PropertyCard listing={item} />}
          ListHeaderComponent={<Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, marginBottom: 12 }}>{filtered.length} {t('results')}</Text>}
          ListEmptyComponent={<Text style={{ fontFamily: fonts.sans, color: colors.ink60, textAlign: 'center', marginTop: 40 }}>{t('noResults')}</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (visible.length < filtered.length) setPage((p) => p + 1); }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ink} />}
        />
      )}

      {/* Filters popup */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 8 }}>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}><View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.ink12 }} /></View>
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
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper }}>{filtered.length} {t('results')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
