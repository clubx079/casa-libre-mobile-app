// Property image gallery: a big feature image + thumbnail strip, tapping opens
// a full-screen lightbox with swipe/prev-next and a counter. The lightbox can be
// dismissed by the close button, by swiping DOWN, or by a swipe-from-the-left-edge
// back gesture — all in addition to the hardware/back button (onRequestClose).
import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { colors, fonts, radii } from '../lib/theme';
import Hatch from './Hatch';

const { width: SW, height: SH } = Dimensions.get('window');
const DISMISS_DY = 120;      // downward drag past this closes the viewer
const DISMISS_DX = 70;       // left-edge drag past this closes the viewer

export default function ImageGallery({ images = [], badge, topRight }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const has = images.length > 0;

  // Drag offsets for the dismissible lightbox (Reanimated shared values).
  const ty = useSharedValue(0);
  const tx = useSharedValue(0);

  const close = () => setOpen(false);
  // Reset the drag transform every time the viewer opens.
  useEffect(() => { if (open) { ty.value = 0; tx.value = 0; } }, [open]);

  // Swipe DOWN to dismiss. Only engages on a mostly-vertical drag (failOffsetX),
  // so horizontal swipes still page the gallery.
  const panDown = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-18, 18])
    .onUpdate((e) => { ty.value = e.translationY; })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DY || e.velocityY > 850) {
        ty.value = withTiming(SH, { duration: 180 }, () => runOnJS(close)());
      } else {
        ty.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // Swipe from the LEFT EDGE (back gesture). Lives on a thin strip so it never
  // competes with the horizontal pager in the middle of the screen.
  const panEdge = Gesture.Pan()
    .activeOffsetX(16)
    .failOffsetY([-24, 24])
    .onUpdate((e) => { tx.value = Math.max(0, e.translationX); })
    .onEnd((e) => {
      if (e.translationX > DISMISS_DX || e.velocityX > 800) {
        tx.value = withTiming(SW, { duration: 180 }, () => runOnJS(close)());
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { translateX: tx.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => {
    const drag = Math.abs(ty.value) + Math.abs(tx.value);
    return { opacity: interpolate(drag, [0, SH * 0.5], [1, 0.25], Extrapolation.CLAMP) };
  });

  return (
    <View>
      <Pressable onPress={() => has && setOpen(true)} style={{ height: 300, borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.hatch }}>
        {has ? (
          <Image source={{ uri: images[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        ) : (
          <Hatch style={{ width: '100%', height: '100%' }} />
        )}
        {badge ? (
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill }}>
            <Text style={{ color: colors.paper, fontFamily: fonts.mono, fontSize: 11 }}>{badge}</Text>
          </View>
        ) : null}
        {topRight ? <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>{topRight}</View> : null}
        {has ? (
          <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink }}>1 / {images.length}</Text>
          </View>
        ) : null}
      </Pressable>

      {images.length > 1 ? (
        <FlatList
          horizontal
          data={images.slice(0, 12)}
          keyExtractor={(u, i) => u + i}
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => { setIdx(index); setOpen(true); }} style={{ marginRight: 8 }}>
              <Image source={{ uri: item }} style={{ width: 84, height: 64, borderRadius: 10, backgroundColor: colors.hatch }} contentFit="cover" />
            </Pressable>
          )}
        />
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* Backdrop fades as the viewer is dragged away. */}
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, backdropStyle]} />
        <GestureDetector gesture={panDown}>
          <Animated.View style={[{ flex: 1 }, contentStyle]}>
            <FlatList
              horizontal
              pagingEnabled
              data={images}
              initialScrollIndex={idx}
              getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
              keyExtractor={(u, i) => u + i}
              onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
              renderItem={({ item }) => (
                <View style={{ width: SW, height: SH, alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={{ uri: item }} style={{ width: SW, height: SH * 0.8 }} contentFit="contain" />
                </View>
              )}
            />
            <Pressable onPress={close} style={{ position: 'absolute', top: 50, right: 20 }} hitSlop={14}>
              <Ionicons name="close" size={30} color="#fff" />
            </Pressable>
            <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill }}>
              <Text style={{ color: '#fff', fontFamily: fonts.mono }}>{idx + 1} / {images.length}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
        {/* Left-edge back-swipe strip (thin, so the pager keeps the rest of the width). */}
        <GestureDetector gesture={panEdge}>
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 24 }} />
        </GestureDetector>
      </Modal>
    </View>
  );
}
