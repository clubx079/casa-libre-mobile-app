// Pin preview carousel — slides up above the listings sheet when a map pin is
// tapped. Swipe left/right through the tapped listing and its nearest in-view
// neighbours (max 30, then a "see all in the list" card). The parent highlights
// the pin of whichever card is showing (onIndexChange) and keeps it on screen.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, FlatList, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, softShadow } from '../lib/theme';
import { fullUsd, pyg } from '../lib/format';
import { metaLine, typeLabel, zoneLine } from '../lib/display';
import { useI18n } from '../lib/i18n';
import Hatch from './Hatch';
import SaveButton from './SaveButton';

const IMG_H = 132;
export const PREVIEW_H = IMG_H + 96; // card height — the parent keeps the pin above it
const GAP = 10;

function PreviewCard({ l, width, onPress }) {
  const { lang } = useI18n();
  const per = l.mode === 'alquiler' ? (lang === 'en' ? '/mo' : '/mes') : '';
  const promoted = !!(l.verified || l.plan);
  const meta = [metaLine(l, lang), typeLabel(l)].filter(Boolean).join('  ·  ');
  return (
    <Pressable onPress={onPress} style={{ width, height: PREVIEW_H }}>
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.card, borderWidth: promoted ? 1.5 : 1, borderColor: promoted ? colors.ink : colors.ink12, overflow: 'hidden', ...softShadow, shadowOpacity: 0.18 }}>
        <View style={{ height: IMG_H, backgroundColor: colors.hatch }}>
          {l.image ? (
            <Image source={{ uri: l.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} recyclingKey={l.id} />
          ) : (
            <Hatch style={{ width: '100%', height: '100%' }} />
          )}
          <View style={{ position: 'absolute', top: 6, right: 6 }}>
            <SaveButton id={l.id} variant="card" />
          </View>
          {promoted ? (
            <View style={{ position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill }}>
              <MaterialIcons name="verified" size={12} color={colors.paper} />
              <Text style={{ color: colors.paper, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.5 }}>{(lang === 'en' ? 'Verified' : 'Verificada').toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{l.usd ? fullUsd(l.usd) : '—'}</Text>
            {per ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60 }}>{per}</Text> : null}
            {l.usd ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink45, marginLeft: 'auto' }} numberOfLines={1}>{pyg(l.usd)}</Text> : null}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink70, marginTop: 3 }} numberOfLines={1}>{meta}</Text>
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink, marginTop: 2 }} numberOfLines={1}>{zoneLine(l) || l.address || ''}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SeeAllCard({ width, more, onPress }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} style={{ width, height: PREVIEW_H }}>
      <View style={{ flex: 1, backgroundColor: colors.ink, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center', gap: 8, ...softShadow }}>
        <Ionicons name="list" size={26} color={colors.paper} />
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 17, color: colors.paper }}>{t('seeAllInList')}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.paper, opacity: 0.7 }}>+{more} {t('moreInArea')}</Text>
      </View>
    </Pressable>
  );
}

export default function PinPreview({ items, more = 0, bottom, onIndexChange, onOpen, onSeeAll }) {
  const { width: W } = useWindowDimensions();
  const cardW = Math.round(W * 0.9);
  const side = Math.round((W - cardW) / 2);
  const interval = cardW + GAP;
  const lastIdx = useRef(0);
  useEffect(() => { lastIdx.current = 0; }, [items[0]?.id]);
  const data = more > 0 ? [...items, { __seeAll: true, id: '__see_all__' }] : items;

  const onEnd = (e) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.x / interval)));
    if (i === lastIdx.current) return;
    lastIdx.current = i;
    if (i < items.length && onIndexChange) onIndexChange(i);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(160)}
      style={{ position: 'absolute', left: 0, right: 0, bottom, height: PREVIEW_H }}
      pointerEvents="box-none"
    >
      <FlatList
        key={items[0]?.id}
        data={data}
        horizontal
        keyExtractor={(l) => l.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        onMomentumScrollEnd={onEnd}
        renderItem={({ item }) => item.__seeAll
          ? <SeeAllCard width={cardW} more={more} onPress={onSeeAll} />
          : <PreviewCard l={item} width={cardW} onPress={() => onOpen(item)} />}
      />
    </Animated.View>
  );
}
