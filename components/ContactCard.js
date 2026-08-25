// Seller contact card (mobile): Call + Copy number here; the big WhatsApp CTA
// lives in the sticky bottom bar (matches the website's mobile layout — no
// duplicate WhatsApp button). Neutral seller role; anti-scam note; the
// "not responding? report" link opens a bottom sheet.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking, ToastAndroid, Platform, Alert, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { telLink, genToken, trackContact, reportUnresponsive, normalizePy } from '../lib/contact';

function toast(msg) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

export default function ContactCard({ listing: l }) {
  const { t } = useI18n();
  const token = useMemo(() => genToken(), [l.id]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [sending, setSending] = useState(false);
  const phone = l.contact_phone;
  if (!phone) return null;

  const call = () => { trackContact({ listingId: l.id, token, channel: 'call' }); Linking.openURL(telLink(phone)).catch(() => {}); };
  const copy = async () => { trackContact({ listingId: l.id, token, channel: 'copy' }); await Clipboard.setStringAsync(normalizePy(phone)); toast(t('copied')); };
  const submitReport = async () => {
    setSending(true);
    await reportUnresponsive(l.id);
    setSending(false); setReported(true);
    setTimeout(() => setReportOpen(false), 1200);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radii.card, borderWidth: 1.5, borderColor: colors.ink, padding: 16, ...hardShadow }}>
      {l.user_published && l.contact_name ? (
        <Text style={{ fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink, marginBottom: 4 }}>{l.contact_name}</Text>
      ) : null}
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginBottom: 14 }}>{t('publishedBy')}</Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={call} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, paddingVertical: 13 }}>
          <Ionicons name="call-outline" size={17} color={colors.ink} />
          <Text style={{ fontFamily: fonts.sansMed, color: colors.ink }}>{t('call')}</Text>
        </Pressable>
        <Pressable onPress={copy} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, paddingVertical: 13 }}>
          <Ionicons name="copy-outline" size={16} color={colors.ink} />
          <Text style={{ fontFamily: fonts.sansMed, color: colors.ink }}>{t('copyNumber')}</Text>
        </Pressable>
      </View>

      <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.ink45, marginTop: 14, lineHeight: 16 }}>{t('antiScam')}</Text>

      <Pressable onPress={() => setReportOpen(true)} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, textDecorationLine: 'underline' }}>{t('reportUnresponsive')}</Text>
      </Pressable>

      {/* Report bottom sheet */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable onPress={() => setReportOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}><View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.ink12 }} /></View>
            {reported ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 16, color: colors.ink }}>{t('reportDone')}</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 8 }}>{t('reportTitle')}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink70, lineHeight: 20, marginBottom: 18 }}>{t('reportBody')}</Text>
                <Pressable onPress={submitReport} disabled={sending} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.ink, ...hardShadow, opacity: sending ? 0.6 : 1 }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper }}>{t('reportSend')}</Text>
                </Pressable>
                <Pressable onPress={() => setReportOpen(false)} style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}>
                  <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink60 }}>{t('cancel')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
