import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fonts, radii } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { fetchListings } from '../../lib/listings';
import { title, metaLine, typeLabel } from '../../lib/display';
import PropertyCard from '../../components/PropertyCard';
import PropertyMap from '../../components/PropertyMap';
import Wordmark from '../../components/Wordmark';

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TYPE_KEYS = ['all', 'casa', 'depto', 'duplex', 'comercial', 'oficina', 'deposito', 'edificio', 'condominio', 'otro'];
const TYPE_LABELS = { all: 'Todos', casa: 'Casa', depto: 'Depto', duplex: 'Dúplex', comercial: 'Comercial', oficina: 'Oficina', deposito: 'Depósito', edificio: 'Edificio', condominio: 'Condominio', otro: 'Otro' };
function typeKey(t) {
  const s = norm(t);
  if (/departamento|depto|apartment/.test(s)) return 'depto';
  if (/duplex|dúplex/.test(s)) return 'duplex';
  if (/casa|house/.test(s)) return 'casa';
  if (/comercial|local|tienda|negoc/.test(s)) return 'comercial';
  if (/oficina|office/.test(s)) return 'oficina';
  if (/dep(o|ó)sito|galp/.test(s)) return 'deposito';
  if (/edificio|building/.test(s)) return 'edificio';
  if (/condominio|condo/.test(s)) return 'condominio';
  return 'otro';
}

const PER_PAGE = 24;

export default function Marketplace() {
  const { t, lang, setLang } = useI18n();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState('all'); // all | venta | alquiler
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [sort, setSort] = useState('relevancia');
  const [view, setView] = useState('list'); // list | map
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const { listings } = await fetchListings({ mode: mode === 'all' ? undefined : mode, limit: 600 });
      setRaw(listings);
    } catch (e) {
      setRaw([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const filtered = useMemo(() => {
    let out = raw;
    if (q.trim()) {
      const nq = norm(q);
      out = out.filter((l) => [l.neighborhood, l.city, l.address, l.type, typeLabel(l)].some((f) => norm(f).includes(nq)));
    }
    if (typeF !== 'all') out = out.filter((l) => typeKey(l.type) === typeF);
    if (bedF !== 'all') { const min = Number(bedF); out = out.filter((l) => (l.beds || 0) >= min); }
    if (priceF !== 'all') {
      out = out.filter((l) => {
        const v = l.usd || 0;
        if (mode === 'alquiler') {
          if (priceF === 'lo') return v < 500;
          if (priceF === 'mid') return v >= 500 && v <= 1000;
          return v > 1000;
        }
        if (priceF === 'lo') return v < 100000;
        if (priceF === 'mid') return v >= 100000 && v <= 200000;
        return v > 200000;
      });
    }
    const usdVal = (l) => l.usd ?? (l.pyg ? l.pyg / 7500 : 0);
    if (sort === 'precio_asc') out = [...out].sort((a, b) => usdVal(a) - usdVal(b));
    else if (sort === 'precio_desc') out = [...out].sort((a, b) => usdVal(b) - usdVal(a));
    else if (sort === 'area_desc') out = [...out].sort((a, b) => (b.covered || b.area || 0) - (a.covered || a.area || 0));
    return out;
  }, [raw, q, typeF, bedF, priceF, sort, mode]);

  useEffect(() => { setPage(1); }, [q, typeF, priceF, bedF, sort, mode]);
  const visible = filtered.slice(0, page * PER_PAGE);

  const Chip = ({ active, label, onPress }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: active ? colors.ink : colors.ink30, backgroundColor: active ? colors.ink : colors.card, marginRight: 8 }}>
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: active ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Wordmark size={20} />
        <Pressable onPress={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
          {['ES', 'EN'].map((L) => {
            const on = (L === 'ES') === (lang === 'es');
            return <Text key={L} style={{ paddingHorizontal: 12, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 12, color: on ? colors.paper : colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>{L}</Text>;
          })}
        </Pressable>
      </View>

      {/* Mode chips */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10 }}>
        <Chip active={mode === 'all'} label={t('all')} onPress={() => setMode('all')} />
        <Chip active={mode === 'venta'} label={t('buy')} onPress={() => setMode('venta')} />
        <Chip active={mode === 'alquiler'} label={t('rent')} onPress={() => setMode('alquiler')} />
      </View>

      {/* Search + filter/view buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink12, borderRadius: radii.pill, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={16} color={colors.ink45} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={lang === 'en' ? 'Neighborhood, city…' : 'Barrio, ciudad…'}
            placeholderTextColor={colors.ink45}
            style={{ flex: 1, paddingVertical: 10, marginLeft: 8, fontFamily: fonts.sans, color: colors.ink }}
          />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.ink30} /></Pressable> : null}
        </View>
        <Pressable onPress={() => setShowFilters((s) => !s)} style={{ width: 44, height: 44, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: showFilters ? colors.ink : colors.card }}>
          <Ionicons name="options-outline" size={20} color={showFilters ? colors.paper : colors.ink} />
        </Pressable>
        <Pressable onPress={() => setView(view === 'list' ? 'map' : 'list')} style={{ width: 44, height: 44, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
          <Ionicons name={view === 'list' ? 'map-outline' : 'list-outline'} size={20} color={colors.ink} />
        </Pressable>
      </View>

      {/* Filters panel */}
      {showFilters ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={TYPE_KEYS} keyExtractor={(k) => k}
            renderItem={({ item }) => <Chip active={typeF === item} label={TYPE_LABELS[item]} onPress={() => setTypeF(item)} />} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[['all', t('anyPrice')], ['lo', mode === 'alquiler' ? '<US$500' : '<100k'], ['mid', mode === 'alquiler' ? '500–1000' : '100–200k'], ['hi', mode === 'alquiler' ? '>1000' : '>200k']].map(([k, lb]) => (
              <View key={k} style={{ marginBottom: 8 }}><Chip active={priceF === k} label={lb} onPress={() => setPriceF(k)} /></View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[['all', t('all')], ['1', '1+'], ['2', '2+'], ['3', '3+']].map(([k, lb]) => (
              <Chip key={k} active={bedF === k} label={k === 'all' ? t('beds') + ': ' + t('all') : lb + ' ' + t('beds').toLowerCase()} onPress={() => setBedF(k)} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Results */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></View>
      ) : view === 'map' ? (
        <PropertyMap listings={filtered} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => <PropertyCard listing={item} />}
          ListHeaderComponent={
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, marginBottom: 12 }}>
              {filtered.length} {t('results')}
            </Text>
          }
          ListEmptyComponent={<Text style={{ fontFamily: fonts.sans, color: colors.ink60, textAlign: 'center', marginTop: 40 }}>{t('noResults')}</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (visible.length < filtered.length) setPage((p) => p + 1); }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ink} />}
        />
      )}
    </SafeAreaView>
  );
}
