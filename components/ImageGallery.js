// Property image gallery: a big feature image + thumbnail strip, tapping opens
// a full-screen lightbox with swipe/prev-next and a counter.
import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../lib/theme';
import Hatch from './Hatch';

const { width: SW, height: SH } = Dimensions.get('window');

export default function ImageGallery({ images = [], badge, topRight }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const has = images.length > 0;

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
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
          <Pressable onPress={() => setOpen(false)} style={{ position: 'absolute', top: 50, right: 20 }} hitSlop={14}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
          <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill }}>
            <Text style={{ color: '#fff', fontFamily: fonts.mono }}>{idx + 1} / {images.length}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
