// Marketplace / saved list card — matches the web buyer portal card:
// swipeable image carousel (dots + "i / N" counter), mode badge, save heart,
// USD price (+ ₲ secondary), "Type · N bd · Barrio" title, meta line, and an
// owner-direct / agent pill.
import { useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radii, softShadow } from '../lib/theme';
import { fullUsd, pyg } from '../lib/format';
import { typeName, modeLabel } from '../lib/display';
import { useI18n } from '../lib/i18n';
import Hatch from './Hatch';
import SaveButton from './SaveButton';

export default function PropertyCard({ listing: l, onPress }) {
  const { lang } = useI18n();
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const per = l.mode === 'alquiler' ? (lang === 'en' ? '/mo' : '/mes') : '';
  const go = onPress || (() => router.push(`/property/${l.id}`));

  const imgs = (Array.isArray(l.images) && l.images.length ? l.images : (l.image ? [l.image] : []));
  const n = imgs.length;
  const dotCount = Math.min(n, 5);
  const activeDot = n <= 5 ? idx : Math.round((idx / (n - 1)) * (dotCount - 1));

  // Title: "Apartment · 3 bd · Catedral"  ·  Meta: "124 m² · 3 baths · 1 parking"
  const zone = l.neighborhood || l.city || l.province || '';
  const bd = lang === 'en' ? 'bd' : 'dorm';
  const titleParts = [typeName(l, lang)];
  if (l.beds != null) titleParts.push(`${l.beds} ${bd}`);
  if (zone) titleParts.push(zone);
  const metaParts = [];
  const a = l.covered || l.area;
  if (a) metaParts.push(`${Math.round(a)} m²`);
  if (l.baths != null) metaParts.push(`${l.baths} ${lang === 'en' ? 'baths' : 'baños'}`);
  if (l.parking != null && l.parking !== 0) metaParts.push(`${l.parking} ${lang === 'en' ? 'parking' : 'coch.'}`);

  const sellerLabel = l.user_published
    ? (lang === 'en' ? 'Owner direct' : 'Dueño directo')
    : (lang === 'en' ? 'Agent' : 'Inmobiliaria');

  return (
    <Pressable onPress={go} style={{ marginBottom: 16 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, borderWidth: 1, borderColor: colors.ink08, overflow: 'hidden', ...softShadow }}>
        {/* IMAGE CAROUSEL */}
        <View style={{ height: 230, backgroundColor: colors.hatch }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {n === 0 ? (
            <Hatch style={{ width: '100%', height: '100%' }} />
          ) : w > 0 ? (
            <FlatList
              data={imgs}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              initialNumToRender={1}
              windowSize={2}
              onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / w))}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width: w, height: 230 }} contentFit="cover" transition={160} />
              )}
            />
          ) : (
            <Image source={{ uri: imgs[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={160} />
          )}

          {/* mode badge */}
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill }}>
            <Text style={{ color: colors.paper, fontFamily: fonts.sansBold, fontSize: 12 }}>{modeLabel(l, lang)}</Text>
          </View>

          {/* save heart */}
          <View style={{ position: 'absolute', top: 12, right: 12 }}>
            <SaveButton id={l.id} />
          </View>

          {/* counter */}
          {n > 1 ? (
            <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill }}>
              <Text style={{ color: '#fff', fontFamily: fonts.mono, fontSize: 11 }}>{idx + 1} / {n}</Text>
            </View>
          ) : null}

          {/* dots */}
          {n > 1 ? (
            <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
              {Array.from({ length: dotCount }).map((_, i) => (
                <View key={i} style={{ width: i === activeDot ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeDot ? '#fff' : 'rgba(255,255,255,0.55)' }} />
              ))}
            </View>
          ) : null}
        </View>

        {/* INFO */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{l.usd ? fullUsd(l.usd) : '—'}</Text>
            {per ? <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink60 }}>{per}</Text> : null}
          </View>
          {l.pyg ? <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink45, marginTop: 2 }}>{pyg(l.usd)}</Text> : null}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginTop: 10 }} numberOfLines={1}>{titleParts.join('  ·  ')}</Text>
          {metaParts.length ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink60, marginTop: 4 }} numberOfLines={1}>{metaParts.join('  ·  ')}</Text>
          ) : null}
          <View style={{ alignSelf: 'flex-start', marginTop: 12, borderWidth: 1.5, borderColor: colors.ink30, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.sansMed, fontSize: 12, color: colors.ink }}>{sellerLabel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
