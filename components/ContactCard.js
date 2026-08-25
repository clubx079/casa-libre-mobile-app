// Seller contact card: WhatsApp (green), Call, Copy number. Neutral seller role
// for scraped listings; anti-scam note; report-unresponsive link with a toast.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking, ToastAndroid, Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { waLink, telLink, waMessage, genToken, trackContact, reportUnresponsive, normalizePy } from '../lib/contact';

function toast(msg) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

export default function ContactCard({ listing: l }) {
  const { t } = useI18n();
  const token = useMemo(() => genToken(), [l.id]);
  const [reported, setReported] = useState(false);
  const phone = l.contact_phone;
  if (!phone) return null;

  const openWhatsapp = () => {
    trackContact({ listingId: l.id, token, channel: 'whatsapp' });
    Linking.openURL(waLink(phone, waMessage(l.id, token))).catch(() => toast('WhatsApp no disponible'));
  };
  const call = () => {
    trackContact({ listingId: l.id, token, channel: 'call' });
    Linking.openURL(telLink(phone)).catch(() => {});
  };
  const copy = async () => {
    trackContact({ listingId: l.id, token, channel: 'copy' });
    await Clipboard.setStringAsync(normalizePy(phone));
    toast(t('copied'));
  };
  const report = async () => {
    if (reported) return;
    setReported(true);
    await reportUnresponsive(l.id);
    toast('Reportado. Gracias.');
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radii.card, borderWidth: 1.5, borderColor: colors.ink, padding: 16, ...hardShadow }}>
      {l.user_published && l.contact_name ? (
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink, marginBottom: 4 }}>{l.contact_name}</Text>
      ) : null}
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginBottom: 14 }}>{t('publishedBy')}</Text>

      <Pressable onPress={openWhatsapp} style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: colors.whatsapp, borderColor: colors.ink, borderWidth: 1.5, borderRadius: radii.pill,
        paddingVertical: 15, ...hardShadow,
      }, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }]}>
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: fonts.sansBold, fontSize: 17 }}>{t('chatWhatsapp')}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={call} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12 }}>
          <Ionicons name="call-outline" size={17} color={colors.ink} />
          <Text style={{ fontFamily: fonts.sansMed, color: colors.ink }}>{t('call')}</Text>
        </Pressable>
        <Pressable onPress={copy} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, paddingVertical: 12 }}>
          <Ionicons name="copy-outline" size={16} color={colors.ink} />
          <Text style={{ fontFamily: fonts.sansMed, color: colors.ink }}>{t('copyNumber')}</Text>
        </Pressable>
      </View>

      <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.ink45, marginTop: 14, lineHeight: 16 }}>
        Nunca envíes dinero ni datos personales antes de visitar la propiedad y verificar al publicador.
      </Text>

      <Pressable onPress={report} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: reported ? colors.ink45 : colors.ink60, textDecorationLine: 'underline' }}>
          {reported ? '✓ Reportado' : t('reportUnresponsive')}
        </Text>
      </Pressable>
    </View>
  );
}
