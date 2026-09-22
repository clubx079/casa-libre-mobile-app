// Marketplace / saved list card. Image (or hatch placeholder), mode badge,
// USD primary price (+/mes for rent), ₲ secondary, title, meta, save heart.
import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radii, softShadow } from '../lib/theme';
import { fullUsd, pyg } from '../lib/format';
import { title, metaLine, modeLabel } from '../lib/display';
import { useI18n } from '../lib/i18n';
import Hatch from './Hatch';
import SaveButton from './SaveButton';
import { MaterialIcons } from '@expo/vector-icons';

// Memoised: the map-first screen re-renders the sheet on every map move and
// carousel swipe — without this every visible card re-renders with it.
function PropertyCard({ listing: l, onPress }) {
  const { lang, t } = useI18n();
  const per = l.mode === 'alquiler' ? (lang === 'en' ? '/mo' : '/mes') : '';
  const go = onPress || (() => router.push(`/property/${l.id}`));
  const promoted = !!(l.verified || l.plan); // paid Verified / Landing listing
  return (
    <Pressable onPress={go} style={{ marginBottom: 16 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, borderWidth: promoted ? 1.5 : 1, borderColor: promoted ? colors.ink : colors.ink08, overflow: 'hidden', ...softShadow }}>
        <View style={{ height: 200, backgroundColor: colors.hatch }}>
          {l.image ? (
            <Image source={{ uri: l.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={180} />
          ) : (
            <Hatch style={{ width: '100%', height: '100%' }} />
          )}
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill }}>
            <Text style={{ color: colors.paper, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5 }}>
              {modeLabel(l, lang).toUpperCase()}
            </Text>
          </View>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <SaveButton id={l.id} variant="card" />
          </View>
          {promoted && (
            <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill }}>
              <MaterialIcons name="verified" size={13} color={colors.paper} />
              <Text style={{ color: colors.paper, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.5 }}>{(lang === 'en' ? 'Verified' : 'Verificada').toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink }}>
              {l.usd ? fullUsd(l.usd) : '—'}
            </Text>
            {per ? <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink60 }}>{per}</Text> : null}
          </View>
          {l.pyg ? (
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginTop: 2 }}>{pyg(l.usd)}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink, marginTop: 8 }} numberOfLines={1}>
            {title(l)}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink60, marginTop: 3 }} numberOfLines={1}>
            {metaLine(l, lang)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(PropertyCard, (a, b) => a.listing === b.listing && a.onPress === b.onPress);
