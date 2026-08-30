import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { fetchListings } from '../../lib/listings';
import { typeName } from '../../lib/display';
import { fullUsd } from '../../lib/format';
import Wordmark from '../../components/Wordmark';
import Ticker from '../../components/Ticker';

const MASCOT = require('../../assets/mascot.png');

const H = {
  es: {
    buy: 'Comprar', rent: 'Alquilar', sell: 'Vender', listForFree: 'Publicar gratis',
    heroL1: 'Encontrá tu lugar,', heroL2: 'libremente.',
    heroSub: 'La forma más amigable de comprar,\nalquilar y vender casas en\nAsunción.',
    searchPh: '¿Dónde querés vivir?',
    mascotCaption: '“¡Vamos que se puede!” — Cuate, tu guía',
    justListed: 'Recién publicadas', justListedSerif: 'lo más nuevo del mercado', viewAll: 'Ver todas →',
    forSale: 'En venta', forRent: 'En alquiler', perMonth: '/mes', bd: 'dorm', ba: 'baños',
    stepsTitle: 'Tres pasos y listo',
    steps: [
      { n: '1', t: 'Contanos qué buscás', d: 'Barrio, presupuesto, dormitorios. Cuate te muestra solo lo que vale la pena.' },
      { n: '2', t: 'Contactá al publicador', d: 'Escribile por WhatsApp o llamá directo desde el aviso. Sin intermediarios ni vueltas.' },
      { n: '3', t: 'Cerrá el trato a tu manera', d: 'Coordinás la visita y la operación directamente con quien publica. Vos manejás los tiempos.' },
    ],
    statActive: 'propiedades activas', statComm: 'comisión al publicar', statInstant: 'Al instante', statInstantL: 'publicás tu aviso',
    ctaTitle: 'Tu casa te está buscando', ctaSerif: 'a vos.', ctaSub: 'Gratis para buscar, gratis para publicar. Empezá hoy.',
    explore: 'Explorar propiedades',
    chips: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara'],
    footBuy: 'Comprar', footRent: 'Alquilar', footSell: 'Vender', footAgencies: 'Para inmobiliarias', footLogin: 'Ingresar', footAccount: 'Mi cuenta',
  },
  en: {
    buy: 'Buy', rent: 'Rent', sell: 'Sell', listForFree: 'List for free',
    heroL1: 'Find your place,', heroL2: 'freely.',
    heroSub: 'The friendliest way to buy,\nrent and sell homes in\nAsunción.',
    searchPh: 'Where do you want to live?',
    mascotCaption: '“Let’s go!” — Cuate, your guide',
    justListed: 'Just listed', justListedSerif: 'fresh on the market', viewAll: 'View all →',
    forSale: 'For sale', forRent: 'For rent', perMonth: '/mo', bd: 'bd', ba: 'baths',
    stepsTitle: 'Three steps and you’re in',
    steps: [
      { n: '1', t: 'Tell us what you’re after', d: 'Neighborhood, budget, bedrooms. Cuate only shows you what’s worth your time.' },
      { n: '2', t: 'Contact the publisher', d: 'Message them on WhatsApp or call straight from the listing. No middlemen, no runaround.' },
      { n: '3', t: 'Close the deal your way', d: 'Arrange the visit and the deal directly with whoever posted it. You set the pace.' },
    ],
    statActive: 'active listings', statComm: 'listing commission', statInstant: 'Instant', statInstantL: 'your listing goes live',
    ctaTitle: 'Your home is out there looking', ctaSerif: 'for you.', ctaSub: 'Free to browse, free to list. Start today.',
    explore: 'Explore homes',
    chips: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara'],
    footBuy: 'Buy', footRent: 'Rent', footSell: 'Sell', footAgencies: 'For agencies', footLogin: 'Log in', footAccount: 'Account',
  },
};

const goMarket = (mode, q) => router.push(`/marketplace?mode=${mode}${q ? `&q=${encodeURIComponent(q)}` : ''}`);

export default function Home() {
  const { lang, setLang } = useI18n();
  const { user } = useAuth();
  const t = H[lang];
  const [q, setQ] = useState('');
  const [featured, setFeatured] = useState([]);
  const [count, setCount] = useState(0);
  const [ticker, setTicker] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchListings({ limit: 600 }).then(({ listings }) => {
      if (!alive) return;
      setCount(listings.length);
      setFeatured(listings.slice(0, 4));
      setTicker(listings.slice(0, 16).map((l) => {
        const place = (l.neighborhood || l.city || '').toUpperCase();
        const ty = typeName(l, lang).toUpperCase();
        const pr = l.usd ? fullUsd(l.usd) + (l.mode === 'alquiler' ? t.perMonth : '') : '';
        return [place, ty, pr].filter(Boolean).join(' — ');
      }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [lang]);

  const per = (l) => (l.mode === 'alquiler' ? t.perMonth : '');
  const fTitle = (l) => `${typeName(l, lang)}${l.beds ? ` · ${l.beds} ${t.bd}` : ''}`;
  const fMeta = (l) => {
    const a = l.covered || l.area;
    const place = [l.neighborhood, l.city].filter(Boolean).join(', ');
    const extra = [a && `${Math.round(a)} m²`, l.baths != null && `${l.baths} ${t.ba}`].filter(Boolean).join(' · ');
    return place + (extra ? ` · ${extra}` : '');
  };

  // Segment button (Buy/Rent/Sell) — outlined by default, ink only while pressed.
  const SegBtn = ({ label, onPress, last }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radii.pill, backgroundColor: pressed ? colors.ink : 'transparent' })}>
      {({ pressed }) => <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: pressed ? colors.paper : colors.ink }}>{label}</Text>}
    </Pressable>
  );

  const Chip = ({ label }) => (
    <Pressable onPress={() => goMarket('venta', label)} style={{ borderWidth: 1.5, borderColor: colors.ink25 || colors.ink30, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: colors.card }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink }}>{label}</Text>
    </Pressable>
  );

  const FeaturedCard = ({ l }) => (
    <Pressable onPress={() => router.push(`/property/${l.id}`)} style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden', marginBottom: 16 }}>
      <View style={{ height: 190, backgroundColor: colors.hatch }}>
        {l.image ? <Image source={{ uri: l.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={160} /> : null}
        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill }}>
          <Text style={{ color: colors.paper, fontFamily: fonts.sansBold, fontSize: 12 }}>{l.mode === 'alquiler' ? t.forRent : t.forSale}</Text>
        </View>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 }}>{l.usd ? fullUsd(l.usd) : '—'}{per(l)}</Text>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginTop: 6 }} numberOfLines={1}>{fTitle(l)}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink60, marginTop: 3 }} numberOfLines={1}>{fMeta(l)}</Text>
      </View>
    </Pressable>
  );

  const FootLink = ({ label, onPress }) => (
    <Pressable onPress={onPress} style={{ paddingVertical: 7 }}>
      <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: 'rgba(249,244,238,0.7)' }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <Ticker items={ticker} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
          <Wordmark size={22} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
              {['ES', 'EN'].map((Lb) => {
                const on = (Lb === 'ES') === (lang === 'es');
                return <Text key={Lb} style={{ paddingHorizontal: 12, paddingVertical: 6, fontFamily: fonts.monoMed, fontSize: 12, color: on ? colors.paper : colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>{Lb}</Text>;
              })}
            </Pressable>
            <Pressable onPress={() => router.push('/publish')} style={{ backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.paper }}>{t.listForFree}</Text>
            </Pressable>
          </View>
        </View>

        {/* HERO */}
        <View style={{ paddingHorizontal: 20, paddingTop: 22, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 48, lineHeight: 50, letterSpacing: -1.5, color: colors.ink, textAlign: 'center' }}>
            {t.heroL1}{'\n'}<Text style={{ fontFamily: fonts.serif, fontSize: 52, color: colors.ink }}>{t.heroL2}</Text>
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 17, lineHeight: 25, color: colors.ink60, textAlign: 'center', marginTop: 20, alignSelf: 'stretch' }}>{t.heroSub}</Text>
        </View>

        {/* BUY / RENT / SELL */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, padding: 4 }}>
            <SegBtn label={t.buy} onPress={() => goMarket('venta')} />
            <SegBtn label={t.rent} onPress={() => goMarket('alquiler')} />
            <SegBtn label={t.sell} onPress={() => router.push('/publish')} />
          </View>
        </View>

        {/* SEARCH */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, borderRadius: radii.pill, paddingLeft: 20, paddingRight: 5, height: 60, ...hardShadow }}>
            <TextInput value={q} onChangeText={setQ} placeholder={t.searchPh} placeholderTextColor={colors.ink45} returnKeyType="search" onSubmitEditing={() => goMarket('venta', q)}
              style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink }} />
            <Pressable onPress={() => goMarket('venta', q)} style={{ width: 48, height: 48, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.paper, fontSize: 22, fontFamily: fonts.sans, lineHeight: 24 }}>→</Text>
            </Pressable>
          </View>
        </View>

        {/* CHIPS */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 18, justifyContent: 'center' }}>
          {t.chips.map((c) => <Chip key={c} label={c} />)}
        </View>

        {/* MASCOT + CAPTION */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginTop: 28, marginBottom: 20 }}>
          <Image source={MASCOT} style={{ width: 128, height: 128 }} contentFit="contain" />
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.ink30, borderStyle: 'dashed', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.ink45 }}>{t.mascotCaption}</Text>
          </View>
        </View>

        {/* DARK BLOCK: JUST LISTED + STEPS + STATS */}
        <View style={{ backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 44 }}>
          {/* Just listed */}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 28, color: colors.paper, letterSpacing: -0.5 }}>
            {t.justListed} <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: 'rgba(249,244,238,0.6)' }}>{t.justListedSerif}</Text>
          </Text>
          <Pressable onPress={() => router.push('/marketplace')} style={{ alignSelf: 'flex-start', marginTop: 18, marginBottom: 22, borderWidth: 1.5, borderColor: 'rgba(249,244,238,0.4)', borderRadius: radii.pill, paddingHorizontal: 22, paddingVertical: 11 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: colors.paper }}>{t.viewAll}</Text>
          </Pressable>
          {featured.map((l) => <FeaturedCard key={l.id} l={l} />)}

          {/* Steps */}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 28, color: colors.paper, letterSpacing: -0.5, marginTop: 26, marginBottom: 20 }}>{t.stepsTitle}</Text>
          {t.steps.map((s) => (
            <View key={s.n} style={{ borderWidth: 1, borderColor: 'rgba(249,244,238,0.25)', borderRadius: radii.card, padding: 24, marginBottom: 16 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 44, color: colors.paper, marginBottom: 10 }}>{s.n}</Text>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.paper, marginBottom: 8 }}>{s.t}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: 'rgba(249,244,238,0.6)' }}>{s.d}</Text>
            </View>
          ))}

          {/* Stats */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(249,244,238,0.2)', marginTop: 18, paddingTop: 26, gap: 16 }}>
            {[[`${count.toLocaleString(lang === 'en' ? 'en-US' : 'es-PY')}+`, t.statActive], ['0%', t.statComm], [t.statInstant, t.statInstantL]].map(([v, l], i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 30, color: colors.paper, letterSpacing: -0.5 }}>{v}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: 'rgba(249,244,238,0.5)', marginLeft: 12 }}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ backgroundColor: colors.paper, paddingHorizontal: 24, paddingVertical: 48, alignItems: 'center' }}>
          <Image source={MASCOT} style={{ width: 96, height: 96 }} contentFit="contain" />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: colors.ink, textAlign: 'center', marginTop: 14 }}>
            {t.ctaTitle} <Text style={{ fontFamily: fonts.serif, fontSize: 37, color: colors.ink }}>{t.ctaSerif}</Text>
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 16, color: colors.ink60, textAlign: 'center', marginTop: 12, marginBottom: 26 }}>{t.ctaSub}</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Pressable onPress={() => router.push('/marketplace')} style={{ backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 28, paddingVertical: 15, ...hardShadow }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper }}>{t.explore}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/publish')} style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 28, paddingVertical: 15 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink }}>{t.listForFree}</Text>
            </Pressable>
          </View>
        </View>

        {/* FOOTER */}
        <View style={{ backgroundColor: colors.ink, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}>
          <Wordmark size={22} color={colors.paper} />
          <View style={{ marginTop: 14 }}>
            <FootLink label={t.footBuy} onPress={() => goMarket('venta')} />
            <FootLink label={t.footRent} onPress={() => goMarket('alquiler')} />
            <FootLink label={t.footSell} onPress={() => router.push('/publish')} />
            <FootLink label={t.footAgencies} onPress={() => router.push('/empresas')} />
            {user
              ? <FootLink label={t.footAccount} onPress={() => router.push('/account')} />
              : <FootLink label={t.footLogin} onPress={() => router.push('/auth')} />}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
