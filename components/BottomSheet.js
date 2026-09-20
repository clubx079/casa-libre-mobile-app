// A reusable bottom sheet that slides up and can be SWIPED DOWN to dismiss.
// Drag the grabber (or the header area) downward past a threshold — or flick it —
// and the sheet animates off-screen and closes. No dark backdrop (transparent),
// so it feels smooth like a pushed screen; a soft top shadow lifts it off content.
//
// Usage:
//   <BottomSheet visible={open} onClose={() => setOpen(false)}>
//     ...content (no grabber / no paper wrapper — the sheet provides those)...
//   </BottomSheet>
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, View } from 'react-native';
import { colors } from '../lib/theme';

const SCREEN_H = Dimensions.get('window').height;

export default function BottomSheet({ visible, onClose, children }) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const heightRef = useRef(SCREEN_H * 0.6); // updated from real layout for the close animation
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = () => {
    Animated.timing(translateY, { toValue: heightRef.current + 60, duration: 200, useNativeDriver: true })
      .start(() => { closeRef.current && closeRef.current(); });
  };

  // Slide up whenever it becomes visible.
  useEffect(() => {
    if (visible) {
      translateY.setValue(heightRef.current + 60);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
    }
  }, [visible]);

  // Drag handle: follow the finger downward, dismiss past a threshold or on a flick.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { translateY.setValue(Math.max(0, g.dy)); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 16 }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {/* transparent backdrop — tap outside to close */}
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' }}>
        <Animated.View
          onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) heightRef.current = h; }}
          style={{
            transform: [{ translateY }],
            maxHeight: '90%',
            backgroundColor: colors.paper,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: '#111', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 16,
          }}
        >
          {/* Draggable grabber — swipe this down to dismiss. */}
          <View {...pan.panHandlers} style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.ink12 }} />
          </View>
          {/* Content — taps inside never reach the backdrop. */}
          <Pressable onPress={() => {}}>{children}</Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
