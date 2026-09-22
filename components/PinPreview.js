// Pin preview carousel — slides up above the listings sheet when a map pin is
// tapped. Swipe the card body left/right through the tapped listing and its
// nearest in-view neighbours (max 30, then a "see all in the list" card); swipe
// the PHOTO to page through that listing's images; tap anywhere to open it.
//
// WHY THE PHOTO PAGER IS NOT A ScrollView/FlatList: it lives inside the card
// carousel, which IS a horizontal ScrollView. On Android a parent ScrollView
// intercepts a horizontal drag as soon as it passes touch slop — before a nested
// horizontal ScrollView can start — so the photos never moved and the card slid
// instead. A gesture-handler Pan wins that fight (an activating handler tells its
// ancestors to stop intercepting) and blocksExternalGesture() makes the relation
// explicit, so photo drags page photos while drags on the info row change property.
//
// The parent highlights the pin of whichever card is showing, so the card index is
// reported while the finger is still moving (onScroll, at the half-way point) —
// waiting for onMomentumScrollEnd made the pin visibly lag behind the card.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, softShadow } from '../lib/theme';
import { fullUsd, pyg } from '../lib/format';
import { metaLine, typeLabel, zoneLine } from '../lib/display';
import { useI18n } from '../lib/i18n';
import { fetchListing } from '../lib/listings';
import Hatch from './Hatch';
import SaveButton from './SaveButton';

const IMG_H = 132;
export const PREVIEW_H = IMG_H + 96; // card height — the parent keeps the pin above it
const GAP = 10;
const DOT_WINDOW = 5;                 // dots drawn at once, whatever the photo count
const SNAP = { damping: 24, stiffness: 240, mass: 0.7 };

// The browse feed is slim (one cover image per listing), so the rest of a
// listing's photos are fetched once, on demand, when its card comes into view.
const imgCache = new Map();

function useImages(l, active) {
  const [imgs, setImgs] = useState(() => imgCache.get(l.id) || null);
  const local = l.images && l.images.length ? l.images : null;   // already-full listing
  useEffect(() => {
    if (local) return;
    if (imgCache.has(l.id)) { setImgs(imgCache.get(l.id)); return; }
    if (!active) return;
    let alive = true;
    fetchListing(l.id)
      .then((d) => {
        const arr = d && d.images && d.images.length ? d.images : (d && d.image ? [d.image] : []);
        imgCache.set(l.id, arr);
        if (alive) setImgs(arr);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [l.id, active, local]);
  if (local) return local;
  return imgs && imgs.length ? imgs : (l.image ? [l.image] : []);
}

// Instagram-style dots: at most DOT_WINDOW are drawn and the edge ones shrink, so
// 3 photos and 30 photos both get dots instead of a "6/11" counter.
function Dots({ n, i }) {
  if (n < 2) return null;
  const half = Math.floor(DOT_WINDOW / 2);
  const first = Math.min(Math.max(0, i - half), Math.max(0, n - DOT_WINDOW));
  const last = Math.min(n - 1, first + DOT_WINDOW - 1);
  const out = [];
  for (let k = first; k <= last; k++) {
    const edge = (k === first && first > 0) || (k === last && last < n - 1);
    const size = k === i ? 7 : edge ? 4 : 5.5;
    out.push(<View key={k} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: k === i ? '#fff' : 'rgba(255,255,255,0.6)' }} />);
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(17,17,17,0.45)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill }}>
      {out}
    </View>
  );
}

function Photos({ l, active, outerGesture, onPress }) {
  const images = useImages(l, active);
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const n = images.length;

  useEffect(() => { setI(0); x.value = 0; }, [l.id, w]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .blocksExternalGesture(outerGesture)
    .onStart(() => { startX.value = x.value; })
    .onUpdate((e) => {
      const min = -(n - 1) * w;
      let v = startX.value + e.translationX;
      if (v > 0) v *= 0.3;                          // rubber-band at the first photo
      else if (v < min) v = min + (v - min) * 0.3;  // …and at the last
      x.value = v;
    })
    .onEnd((e) => {
      if (!w) return;
      const cur = -x.value / w;
      let k = Math.round(cur);
      if (e.velocityX < -400) k = Math.ceil(cur);
      else if (e.velocityX > 400) k = Math.floor(cur);
      k = Math.max(0, Math.min(n - 1, k));
      x.value = withSpring(-k * w, { ...SNAP, velocity: e.velocityX });
      runOnJS(setI)(k);
    }), [outerGesture, n, w]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = useMemo(() => Gesture.Tap().maxDuration(300).onEnd((_e, ok) => { if (ok) runOnJS(onPress)(); }), [onPress]);
  const gesture = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {!n || !w ? (
        <Hatch style={{ width: '100%', height: '100%' }} />
      ) : (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flexDirection: 'row', width: w * n, height: IMG_H }, strip]}>
            {images.map((u, k) => (
              <Image key={`${l.id}-${k}`} source={{ uri: u }} style={{ width: w, height: IMG_H }} contentFit="cover" transition={120} />
            ))}
          </Animated.View>
        </GestureDetector>
      )}
      <Dots n={n} i={i} />
    </View>
  );
}

const PreviewCard = memo(function PreviewCard({ l, width, active, onPress, outerGesture }) {
  const { lang } = useI18n();
  const per = l.mode === 'alquiler' ? (lang === 'en' ? '/mo' : '/mes') : '';
  const promoted = !!(l.verified || l.plan);
  const meta = [metaLine(l, lang), typeLabel(l)].filter(Boolean).join('  ·  ');
  return (
    <View style={{ width, height: PREVIEW_H }}>
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.card, borderWidth: promoted ? 1.5 : 1, borderColor: promoted ? colors.ink : colors.ink12, overflow: 'hidden', ...softShadow, shadowOpacity: 0.18 }}>
        <View style={{ height: IMG_H, backgroundColor: colors.hatch, overflow: 'hidden' }}>
          <Photos l={l} active={active} outerGesture={outerGesture} onPress={onPress} />
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
        <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingTop: 8, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{l.usd ? fullUsd(l.usd) : '—'}</Text>
            {per ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60 }}>{per}</Text> : null}
            {l.usd ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink45, marginLeft: 'auto' }} numberOfLines={1}>{pyg(l.usd)}</Text> : null}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink70, marginTop: 3 }} numberOfLines={1}>{meta}</Text>
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink, marginTop: 2 }} numberOfLines={1}>{zoneLine(l) || l.address || ''}</Text>
        </Pressable>
      </View>
    </View>
  );
});

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
  const [idx, setIdx] = useState(0);
  const lastIdx = useRef(0);
  // The card carousel's own scroll gesture — each card's photo pager blocks it.
  const outerGesture = useMemo(() => Gesture.Native(), []);
  useEffect(() => { lastIdx.current = 0; setIdx(0); }, [items[0]?.id]);
  const data = more > 0 ? [...items, { __seeAll: true, id: '__see_all__' }] : items;

  // Report the card change as soon as it crosses the half-way point, so the
  // highlighted pin tracks the swipe instead of trailing it.
  const onScroll = (e) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.x / interval)));
    if (i === lastIdx.current) return;
    lastIdx.current = i;
    setIdx(i);
    if (i < items.length && onIndexChange) onIndexChange(i);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(160)}
      style={{ position: 'absolute', left: 0, right: 0, bottom, height: PREVIEW_H }}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={outerGesture}>
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
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onScroll}
          renderItem={({ item, index }) => item.__seeAll
            ? <SeeAllCard width={cardW} more={more} onPress={onSeeAll} />
            : <PreviewCard l={item} width={cardW} active={Math.abs(index - idx) <= 1} onPress={() => onOpen(item)} outerGesture={outerGesture} />}
        />
      </GestureDetector>
    </Animated.View>
  );
}
