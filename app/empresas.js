// Para empresas — partner/agency landing + lead form. Posts to /api/partner-inquiries.
import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { API_BASE } from '../lib/config';
import Button from '../components/Button';
import Wordmark from '../components/Wordmark';

const WA_NUMBER = '595000000000'; // placeholder — real BIZ number pending
const CONTACT_EMAIL = 'hola@casa-libre.com';

const inputStyle = {
  borderWidth: 1.5,
  borderColor: colors.ink12,
  borderRadius: 14,
  padding: 12,
  fontFamily: fonts.sans,
  fontSize: 15,
  color: colors.ink,
  backgroundColor: colors.card,
};

export default function Empresas() {
  const { t, lang } = useI18n();
  const es = lang !== 'en';

  const [type, setType] = useState('inmobiliaria');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [web, setWeb] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const values = [
    { icon: 'albums-outline', text: es ? 'Publicá todo tu portfolio' : 'Publish your whole portfolio' },
    { icon: 'logo-whatsapp', text: es ? 'Leads directos por WhatsApp' : 'Direct leads on WhatsApp' },
    { icon: 'pricetag-outline', text: es ? 'Sin comisiones' : 'No commissions' },
    { icon: 'stats-chart-outline', text: es ? 'Panel de estadísticas' : 'Analytics dashboard' },
  ];

  const types = [
    { key: 'inmobiliaria', label: es ? 'Inmobiliaria' : 'Agency' },
    { key: 'desarrolladora', label: es ? 'Desarrolladora' : 'Developer' },
    { key: 'otro', label: es ? 'Otro' : 'Other' },
  ];

  const submit = async () => {
    setLoading(true);
    setError('');
    // Honeypot: a filled `web` field means a bot — pretend success, send nothing.
    if (web) {
      setDone(true);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/partner-inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, company, phone, email, city, message, web }),
      });
      if (!res.ok) throw new Error('bad');
      setDone(true);
    } catch {
      setError(es ? 'No se pudo enviar. Intentá de nuevo.' : 'Could not send. Please try again.');
    }
    setLoading(false);
  };

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
          <Ionicons name="checkmark-circle-outline" size={56} color={colors.success} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 24, color: colors.ink, textAlign: 'center' }}>
            {es ? '¡Gracias! Te contactaremos pronto.' : 'Thanks! We\'ll be in touch soon.'}
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Button label={t('backTo')} onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={26} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 22, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Hero */}
          <View style={{ gap: 14 }}>
            <Wordmark size={24} />
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 30, color: colors.ink, lineHeight: 34 }}>
              {t('empresasTitle')}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 16, color: colors.ink70, lineHeight: 23 }}>
              {es
                ? 'Publicá todo tu portfolio gratis y recibí consultas directas de compradores, sin intermediarios ni comisiones.'
                : 'Publish your whole portfolio for free and get inquiries directly from buyers — no middlemen, no commissions.'}
            </Text>
          </View>

          {/* Value props */}
          <View style={{ gap: 14 }}>
            {values.map((v) => (
              <View key={v.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name={v.icon} size={22} color={colors.ink} />
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 16, color: colors.ink, flex: 1 }}>{v.text}</Text>
              </View>
            ))}
          </View>

          {/* Lead form card */}
          <View
            style={[
              {
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: colors.ink,
                borderRadius: radii.card,
                padding: 18,
                gap: 14,
              },
              hardShadow,
            ]}
          >
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, letterSpacing: 1, textTransform: 'uppercase' }}>
              {es ? 'Contanos de tu empresa' : 'Tell us about your company'}
            </Text>

            {/* Type chip selector */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {types.map((tp) => {
                const active = type === tp.key;
                return (
                  <Pressable
                    key={tp.key}
                    onPress={() => setType(tp.key)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: radii.pill,
                      borderWidth: 1.5,
                      borderColor: colors.ink,
                      backgroundColor: active ? colors.ink : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: active ? colors.paper : colors.ink }}>
                      {tp.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput value={name} onChangeText={setName} placeholder={es ? 'Nombre' : 'Name'} placeholderTextColor={colors.ink45} style={inputStyle} />
            <TextInput value={company} onChangeText={setCompany} placeholder={es ? 'Empresa' : 'Company'} placeholderTextColor={colors.ink45} style={inputStyle} />
            <TextInput value={phone} onChangeText={setPhone} placeholder={es ? 'Teléfono' : 'Phone'} placeholderTextColor={colors.ink45} keyboardType="phone-pad" style={inputStyle} />
            <TextInput value={email} onChangeText={setEmail} placeholder={es ? 'Correo' : 'Email'} placeholderTextColor={colors.ink45} autoCapitalize="none" keyboardType="email-address" style={inputStyle} />
            <TextInput value={city} onChangeText={setCity} placeholder={es ? 'Ciudad' : 'City'} placeholderTextColor={colors.ink45} style={inputStyle} />
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={es ? 'Mensaje' : 'Message'}
              placeholderTextColor={colors.ink45}
              multiline
              textAlignVertical="top"
              style={[inputStyle, { minHeight: 90 }]}
            />

            {/* Honeypot — invisible to humans, catches bots */}
            <TextInput
              value={web}
              onChangeText={setWeb}
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="no"
              style={{ height: 0, width: 0, opacity: 0 }}
              pointerEvents="none"
            />

            {error ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.danger }}>{error}</Text>
            ) : null}

            <Button label={es ? 'Enviar' : 'Send'} onPress={submit} loading={loading} />
          </View>

          {/* Direct contact */}
          <View style={{ gap: 12 }}>
            <Button
              label={es ? 'Escribinos por WhatsApp' : 'Message us on WhatsApp'}
              variant="whatsapp"
              icon={<Ionicons name="logo-whatsapp" size={20} color="#fff" />}
              onPress={() => Linking.openURL(`https://wa.me/${WA_NUMBER}`)}
            />
            <Pressable
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 }}
            >
              <Ionicons name="mail-outline" size={18} color={colors.ink60} />
              <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink60 }}>{CONTACT_EMAIL}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
