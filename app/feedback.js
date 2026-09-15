// Feedback modal — 5-star rating + comment. Posts to the web app's /api/feedback.
import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { getApiBase } from '../lib/config';
import Button from '../components/Button';

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

export default function Feedback() {
  const { t, lang } = useI18n();
  const es = lang !== 'en';

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating < 1) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, message, name, email, source: 'mobile' }),
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
            {t('thanks')}
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
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
            <Ionicons name="close" size={28} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink }}>
            {t('feedbackTitle')}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={n <= rating ? colors.ink : colors.ink30}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={es ? 'Contanos más…' : 'Tell us more…'}
            placeholderTextColor={colors.ink45}
            multiline
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 110 }]}
          />

          <View style={{ gap: 12 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={es ? 'Nombre (opcional)' : 'Name (optional)'}
              placeholderTextColor={colors.ink45}
              style={inputStyle}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={es ? 'Correo (opcional)' : 'Email (optional)'}
              placeholderTextColor={colors.ink45}
              autoCapitalize="none"
              keyboardType="email-address"
              style={inputStyle}
            />
          </View>

          {error ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.danger }}>{error}</Text>
          ) : null}

          <Button
            label={t('feedbackSend')}
            onPress={submit}
            loading={loading}
            disabled={rating < 1}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
