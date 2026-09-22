// The map-first search screen's listings sheet: a draggable bottom sheet with three
// snap points (collapsed → half → full) that holds the in-view listings.
//
//  • collapsed: grabber + count line only, just above the tab bar
//  • half:      ~45% of the screen — count + the first card(s)
//  • full:      the whole list; the parent's `header` rows (wordmark, search,
//               Comprar/Alquilar chips) grow in above the count as it rises
//
// The parent owns `sheetY` (a reanimated shared value = the sheet's translateY in
// screen px) so it can fade/move its own map overlays with the sheet.
// The list only scrolls at full; pulling down while it's at the top drags the sheet.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, interpolate, Extrapolation, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, fonts, radii } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import PropertyCard from './PropertyCard';

export const COLLAPSED_H = 76;
const PER_PAGE = 24;
const SPRING = { damping: 22, stiffness: 220, mass: 0.9 };
const FLING = 500; // px/s — faster than this moves one snap in the fling direction

// translateY for each snap, in the parent's coordinate space (H = parent height).
// `full` is 0 — the sheet covers the screen edge to edge, including the status bar
// strip, so the search bar above it lands on the sheet's own paper instead of
// leaving a sliver of map showing above it. The parent's header content leaves
// room for the status bar and the bar itself.
export function sheetSnaps(H) {
  return { full: 0, half: Math.round(H * 0.55), collapsed: H - COLLAPSED_H };
}

function Pill({ label, onPress, dark }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: dark ? colors.ink : colors.card }}>
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 13, color: dark ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const ListingsSheet = forwardRef(function ListingsSheet({
  H, sheetY, onSnapChange, header,
  status, count, globalCount, onZoomOut, onClearFilters, onRetry,
  data, listResetKey,
}, ref) {
  const { t } = useI18n();
  const snaps = sheetSnaps(H);
  const { full, half, collapsed } = snaps;
  const [snap, setSnap] = useState('collapsed');
  const snapRef = useRef('collapsed');
  const [page, setPage] = useState(1);
  const listRef = useRef(null);

  const scrollY = useSharedValue(0);
  const startY = useSharedValue(0);
  const anchor = useSharedValue(0);
  const moved = useSharedValue(false);
  const hdrH = useSharedValue(0);

  const commitSnap = (name) => {
    if (snapRef.current === name) return;
    snapRef.current = name;
    setSnap(name);
    if (onSnapChange) onSnapChange(name);
  };

  // Keep the sheet on its current snap when the screen height becomes known/changes.
  useEffect(() => { if (H > 0) sheetY.value = snaps[snapRef.current]; }, [H]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    snapTo(name) {
      if (!(name in snaps)) return;
      sheetY.value = withSpring(snaps[name], SPRING);
      commitSnap(name);
    },
    getSnap: () => snapRef.current,
  }));

  // New area / filters → back to the top of the list, first page.
  useEffect(() => {
    setPage(1);
    if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: false });
  }, [listResetKey]);

  // Release: a fling moves one snap in its direction, otherwise snap to the nearest.
  const settle = (vy) => {
    'worklet';
    const y = sheetY.value;
    const pts = [full, half, collapsed];
    let target = pts[0], best = Infinity;
    if (vy < -FLING) {
      target = full;
      for (let i = pts.length - 1; i >= 0; i--) if (pts[i] < y - 1) { target = pts[i]; break; }
    } else if (vy > FLING) {
      target = collapsed;
      for (let i = 0; i < pts.length; i++) if (pts[i] > y + 1) { target = pts[i]; break; }
    } else {
      for (let i = 0; i < pts.length; i++) { const d = Math.abs(pts[i] - y); if (d < best) { best = d; target = pts[i]; } }
    }
    sheetY.value = withSpring(target, { ...SPRING, velocity: vy });
    runOnJS(commitSnap)(target === full ? 'full' : target === half ? 'half' : 'collapsed');
  };
  const clampY = (v) => { 'worklet'; return Math.min(collapsed, Math.max(full, v)); };

  // Grabber + header + count line: always drags the sheet.
  const headerPan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => { startY.value = sheetY.value; })
    .onUpdate((e) => { sheetY.value = clampY(startY.value + e.translationY); })
    .onEnd((e) => { settle(e.velocityY); });

  // List body: drags the sheet unless it's full and the list is scrolled down.
  const native = Gesture.Native();
  const bodyPan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .simultaneousWithExternalGesture(native)
    .onStart(() => { startY.value = sheetY.value; anchor.value = 0; moved.value = false; })
    .onUpdate((e) => {
      if (startY.value > full + 1) { sheetY.value = clampY(startY.value + e.translationY); moved.value = true; return; }
      // Full: the list owns the gesture until it's at the very top and the finger pulls down.
      if (scrollY.value > 0.5) { anchor.value = e.translationY; return; }
      const d = e.translationY - anchor.value;
      if (d > 0) { sheetY.value = clampY(full + d); moved.value = true; } else sheetY.value = full;
    })
    .onEnd((e) => { if (moved.value) settle(e.velocityY); });

  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  // The full-state header rows grow in between the half and full snaps.
  const hdrStyle = useAnimatedStyle(() => {
    const p = interpolate(sheetY.value, [full, half], [1, 0], Extrapolation.CLAMP);
    return { height: hdrH.value * p, opacity: p };
  });
  // Square off the top as it merges with the bar at full; rounded while it floats.
  const radiusStyle = useAnimatedStyle(() => {
    const r = interpolate(sheetY.value, [full, full + 80], [0, 20], Extrapolation.CLAMP);
    return { borderTopLeftRadius: r, borderTopRightRadius: r };
  });
  // At full the search bar sits right on top of the grabber, so fade it out there.
  const grabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetY.value, [full, full + 60], [0, 1], Extrapolation.CLAMP),
  }));

  const visible = (data || []).slice(0, page * PER_PAGE);
  const isFull = snap === 'full';

  let countLine;
  if (status === 'boot' || status === 'moving') {
    countLine = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator size="small" color={colors.ink} />
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink70 }}>{status === 'boot' ? t('loadingProps') : t('searchingArea')}</Text>
      </View>
    );
  } else if (status === 'error') {
    countLine = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>{t('loadError')}</Text>
        <Pill label={t('retry')} onPress={onRetry} dark />
      </View>
    );
  } else {
    countLine = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink }}>
          {count.toLocaleString('es-PY')} {count === 1 ? t('propInArea') : t('propsInArea')}
        </Text>
        {count === 0 && globalCount === 0 ? <Pill label={t('clearFilters')} onPress={onClearFilters} /> : null}
        {count === 0 && globalCount > 0 ? <Pill label={t('zoomOut')} onPress={onZoomOut} /> : null}
      </View>
    );
  }

  return (
    <Animated.View
      style={[{
        position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, H),
        backgroundColor: colors.paper,
        shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 12,
      }, sheetStyle, radiusStyle]}
    >
      <GestureDetector gesture={headerPan}>
        <View>
          <Animated.View style={[{ alignItems: 'center', paddingTop: 8, paddingBottom: 6 }, grabStyle]}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.ink30 }} />
          </Animated.View>
          <Animated.View style={[{ overflow: 'hidden' }, hdrStyle]} pointerEvents={isFull ? 'auto' : 'none'}>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }} onLayout={(e) => { hdrH.value = e.nativeEvent.layout.height; }}>
              {header}
            </View>
          </Animated.View>
          <View style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
            {countLine}
          </View>
        </View>
      </GestureDetector>

      <GestureDetector gesture={bodyPan}>
        <View style={{ flex: 1 }}>
          <GestureDetector gesture={native}>
            <Animated.FlatList
              ref={listRef}
              data={status === 'boot' ? [] : visible}
              keyExtractor={(l) => l.id}
              renderItem={({ item }) => <PropertyCard listing={item} />}
              contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 48 }}
              style={{ opacity: status === 'moving' ? 0.4 : 1 }}
              scrollEnabled={isFull}
              bounces={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onEndReachedThreshold={0.5}
              onEndReached={() => { if (visible.length < (data || []).length) setPage((p) => p + 1); }}
            />
          </GestureDetector>
        </View>
      </GestureDetector>

    </Animated.View>
  );
});

export default ListingsSheet;
