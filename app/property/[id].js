import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { fetchListing } from '../../lib/listings';
import { fullUsd, pyg } from '../../lib/format';
import { title, modeLabel, typeLabel, zoneLine } from '../../lib/display';
import { REF } from '../../lib/format';
import { waLink, waMessage, genToken, trackContact } from '../../lib/contact';
import ImageGallery from '../../components/ImageGallery';
import ContactCard from '../../components/ContactCard';
import PropertyMap from '../../components/PropertyMap';
import SaveButton from '../../components/SaveButton';
import ShareButton from '../../components/ShareButton';

function Spec({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={{ minWidth: 78 }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink45, letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function PropertyDetail() {
  const { id } = useLocalSearchParams();
  const { t, lang } = useI18n();
  const [l, setL] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchListing(id).then((d) => { if (alive) { setL(d); setLoading(false); } }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></SafeAreaView>;
  if (!l) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontFamily: fonts.sans, color: colors.ink60 }}>{t('noResults')}</Text>
      <Pressable onPress={() => router.back()}><Text style={{ fontFamily: fonts.mono, color: colors.ink }}>← {t('home')}</Text></Pressable>
    </SafeAreaView>
  );

  const per = l.mode === 'alquiler' ? (lang === 'en' ? '/mo' : '/mes') : '';
  const token = genToken();
  const stickyWhatsapp = () => {
    if (!l.contact_phone) return;
    trackContact({ listingId: l.id, token, channel: 'whatsapp' });
    Linking.openURL(waLink(l.contact_phone, waMessage(l.id, token))).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginLeft: 4 }} numberOfLines={1}>
          {t('listings')} / {l.city || l.neighborhood || ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <ImageGallery
          images={l.images}
          badge={modeLabel(l, lang).toUpperCase()}
          topRight={[<ShareButton key="s" listing={l} />, <SaveButton key="f" id={l.id} variant="card" />]}
        />

        {/* Kicker + title + price */}
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginTop: 18, letterSpacing: 0.5 }}>
          {modeLabel(l, lang).toUpperCase()} · {t('ref')} {REF(l.id)}
        </Text>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink, marginTop: 6 }}>{title(l)}</Text>
        {zoneLine(l) ? <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink60, marginTop: 2 }}>{zoneLine(l)}</Text> : null}

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 30, color: colors.ink }}>{l.usd ? fullUsd(l.usd) : '—'}</Text>
          {per ? <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink60 }}>{per}</Text> : null}
        </View>
        {l.pyg ? <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink45, marginTop: 2 }}>≈ {pyg(l.usd)}</Text> : null}

        {/* Specs rail */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.ink08 }}>
          <Spec label={lang === 'en' ? 'BEDS' : 'DORM.'} value={l.beds} />
          <Spec label={lang === 'en' ? 'BATHS' : 'BAÑOS'} value={l.baths} />
          <Spec label={t('m2Built').toUpperCase()} value={l.covered ? Math.round(l.covered) : null} />
          <Spec label={lang === 'en' ? 'LAND m²' : 'TERRENO m²'} value={l.lot ? Math.round(l.lot) : null} />
          <Spec label={t('parking').toUpperCase()} value={l.parking} />
        </View>

        {/* Contact */}
        <View style={{ marginTop: 22 }}><ContactCard listing={l} /></View>

        {/* Description */}
        {l.description ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 8 }}>{t('description')}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.ink70 }}>
              {l.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()}
            </Text>
          </View>
        ) : null}

        {/* Features */}
        {l.features?.length ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 10 }}>{t('features')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {l.features.map((f, i) => (
                <View key={i} style={{ borderWidth: 1, borderColor: colors.ink12, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink70 }}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Location */}
        {l.lat && l.lng ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 10 }}>{t('location')}</Text>
            <PropertyMap single={l} style={{ height: 220, borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink12 }} />
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky WhatsApp bar */}
      {l.contact_phone ? (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.ink08 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink }}>{l.usd ? fullUsd(l.usd) : '—'}{per ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60 }}> {per}</Text> : null}</Text>
          </View>
          <Pressable onPress={stickyWhatsapp} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.whatsapp, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: 20, ...hardShadow }, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: fonts.sansBold, fontSize: 15 }}>WhatsApp</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
