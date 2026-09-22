// A reusable bottom sheet that slides up and can be SWIPED DOWN to dismiss.
// Drag the grabber (or the header area) downward past a threshold — or flick it —
// and the sheet animates off-screen and closes. No dark backdrop (transparent),
// so it feels smooth like a pushed screen; a soft top shadow lifts it off content.
//
// The drag runs on the UI thread (gesture-handler + reanimated). It used to be a
// PanResponder writing an Animated.Value from JS, which meant every frame of the
// drag waited on the JS thread — on a busy screen (the map-first search) the
// sheet visibly lagged seconds behind the finger.
//
// Usage:
//   <BottomSheet visible={open} onClose={() => setOpen(false)}>
//     ...content (no grabber / no paper wrapper — the sheet provides those)...
//   </BottomSheet>
import { useEffect, useRef } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { colors } from '../lib/theme';

const SCREEN_H = Dimensions.get('window').height;
const OPEN = { damping: 20, stiffness: 220, mass: 0.8 };
const DISMISS_DY = 80;    // drag further than this and it closes
const DISMISS_VY = 500;   // …or flick it faster than this

export default function BottomSheet({ visible, onClose, children }) {
  const ty = useSharedValue(SCREEN_H);
  const h = useSharedValue(SCREEN_H * 0.6); // real height, from onLayout
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const finish = () => { if (closeRef.current) closeRef.current(); };

  const close = () => {
    ty.value = withTiming(h.value + 60, { duration: 180 }, (done) => { if (done) runOnJS(finish)(); });
  };

  // Slide up whenever it becomes visible.
  useEffect(() => {
    if (visible) {
      ty.value = h.value + 60;
      ty.value = withSpring(0, OPEN);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    // the grabber strip is only ~25px tall — give the drag a bigger target
    .hitSlop({ top: 12, bottom: 28, left: 0, right: 0 })
    .onUpdate((e) => { ty.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DY || e.velocityY > DISMISS_VY) {
        ty.value = withTiming(h.value + 60, { duration: 180 }, (done) => { if (done) runOnJS(finish)(); });
      } else {
        ty.value = withSpring(0, OPEN);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {/* A Modal is its own view root, so gesture-handler needs a root inside it. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* transparent backdrop — tap outside to close. A SIBLING of the sheet,
              never its parent: wrapping the sheet made a drag on the grabber count
              as a tap on the backdrop, so short drags closed it instead of
              springing back. */}
          <Pressable onPress={close} style={StyleSheet.absoluteFill} />
          <Animated.View
            onLayout={(e) => { const v = e.nativeEvent.layout.height; if (v > 0) h.value = v; }}
            style={[{
              maxHeight: '90%',
              backgroundColor: colors.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: '#111', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 16,
            }, sheetStyle]}
          >
            {/* Draggable grabber — swipe this down to dismiss. */}
            <GestureDetector gesture={pan}>
              <View style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
                <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.ink12 }} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
