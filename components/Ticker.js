// Top strip — an auto-scrolling marquee of live listing headlines, mirroring the
// website's ticker. Measures one row, then loops translateX; a duplicate row
// fills the gap for a seamless scroll.
import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Easing } from 'react-native';
import { colors, fonts } from '../lib/theme';

function Row({ items, onLayout }) {
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.paper, paddingHorizontal: 22, letterSpacing: 0.5 }} numberOfLines={1}>{it}</Text>
          <View style={{ width: 1, height: 12, backgroundColor: 'rgba(249,244,238,0.3)' }} />
        </View>
      ))}
    </View>
  );
}

export default function Ticker({ items = [] }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const list = items.length ? items : ['CASA LIBRE — PROPIEDADES EN PARAGUAY'];

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: Math.max(w * 20, 9000), easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [w, x]);

  return (
    <View style={{ backgroundColor: colors.ink, paddingVertical: 8, overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        <Row items={list} onLayout={(e) => setW(e.nativeEvent.layout.width)} />
        <Row items={list} />
      </Animated.View>
    </View>
  );
}
