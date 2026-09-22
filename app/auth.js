// Sign in — email + a 6-digit code, or Google.
//
// One screen handles new and returning people alike: /api/auth/code/send decides
// whether the code signs them in or creates the account, and /api/auth/code/verify
// starts the session either way.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { auth, useAuth } from '../lib/session';
import { colors, fonts, radii } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Button from '../components/Button';
import Wordmark from '../components/Wordmark';

const inputStyle = {
  borderWidth: 1.5, borderColor: colors.ink12, borderRadius: 14,
  padding: 12, fontFamily: fonts.sans, fontSize: 16, color: colors.ink,
  backgroundColor: colors.card, alignSelf: 'stretch',
};

// Module-scope UI helpers — defining these inside the component would remount
// every TextInput on each keystroke ("keyboard closes after one word" bug).
function Heading({ children }) {
  return (
    <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink, marginTop: 20, marginBottom: 8, alignSelf: 'stretch' }}>
      {children}
    </Text>
  );
}

function Sub({ children }) {
  return (
    <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, color: colors.ink60, marginBottom: 16, alignSelf: 'stretch', lineHeight: 21 }}>
      {children}
    </Text>
  );
}

function ErrorText({ error }) {
  if (!error) return null;
  return (
    <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.danger, marginTop: 12, alignSelf: 'stretch' }}>{error}</Text>
  );
}

export default function Auth() {
  const { t, lang } = useI18n();
  const { refresh } = useAuth();
  const es = lang !== 'en';

  const [step, setStep] = useState('email');   // email | code
  const [mode, setMode] = useState('login');   // what the code will do: login | signup
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resentAt, setResentAt] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => { if (step === 'code') setTimeout(() => codeRef.current?.focus(), 350); }, [step]);

  const close = () => router.back();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Step 1 — ask for the code.
  const sendCode = async (resend = false) => {
    if (!emailOk) { setError(es ? 'Ingresá un correo válido' : 'Enter a valid email'); return; }
    setError(''); setLoading(true);
    const { ok, data, status } = await auth.sendCode(email.trim(), fullName.trim() || undefined);
    setLoading(false);
    if (!ok) {
      if (status === 429 || data?.error === 'rate_limited' || data?.error === 'cooldown') {
        setError(es ? 'Esperá un momento antes de pedir otro código.' : 'Wait a moment before asking for another code.');
      } else if (data?.error === 'email_send_failed') {
        setError(es ? 'No pudimos enviar el correo. Probá de nuevo.' : "We couldn't send the email. Try again.");
      } else {
        setError(es ? 'No se pudo enviar el código' : 'Could not send the code');
      }
      return;
    }
    setMode(data?.mode === 'signup' ? 'signup' : 'login');
    setStep('code');
    if (resend) setResentAt(Date.now());
  };

  // Step 2 — confirm it and start the session.
  const verifyCode = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 6) { setError(es ? 'Ingresá el código de 6 dígitos' : 'Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    const { ok, data } = await auth.verifyCode({ email: email.trim(), code: c, fullName: fullName.trim() || undefined });
    setLoading(false);
    if (!ok) {
      const left = data?.attemptsLeft;
      setError(
        data?.error === 'expired' ? (es ? 'El código venció. Pedí uno nuevo.' : 'That code expired. Ask for a new one.')
          : es ? `Código incorrecto${typeof left === 'number' ? ` · te quedan ${left} intentos` : ''}`
               : `Wrong code${typeof left === 'number' ? ` · ${left} tries left` : ''}`
      );
      return;
    }
    await refresh();
    router.back();
  };

  const onGoogle = async () => {
    setError('');
    try {
      // Deep link the site's OAuth callback returns to (casalibre://auth in a build,
      // exp://…/--/auth in Expo Go). openAuthSessionAsync closes the browser and hands
      // us that URL, carrying the one-time session token to exchange for the cookie.
      const redirectUrl = Linking.createURL('auth');
      const { ok, data } = await auth.googleUrl(redirectUrl);
      if (!ok || !data?.url) { setError(es ? 'Google no disponible' : 'Google sign-in unavailable'); return; }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type !== 'success' || !result.url) return; // user cancelled / dismissed
      const token = Linking.parse(result.url).queryParams?.token;
      if (!token) { setError(es ? 'No se pudo iniciar con Google' : 'Google sign-in failed'); return; }
      const ex = await auth.mobileExchange(String(token));
      if (ex.ok) { await refresh(); router.back(); return; }
      setError(es ? 'No se pudo iniciar con Google' : 'Google sign-in failed');
    } catch {
      setError(es ? 'No se pudo iniciar con Google' : 'Google sign-in failed');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
          <Wordmark size={20} />
          <Pressable onPress={close} hitSlop={12} style={{ padding: 6 }}>
            <Ionicons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, alignItems: 'flex-start' }} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
            <>
              <Heading>{t('signIn')}</Heading>
              <TextInput
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); }}
                placeholder={es ? 'tu@correo.com' : 'you@email.com'}
                placeholderTextColor={colors.ink45}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={() => sendCode()}
                style={inputStyle}
              />
              <ErrorText error={error} />
              <Button label={es ? 'Enviarme el código' : 'Email me the code'} onPress={() => sendCode()} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginVertical: 18 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.ink12 }} />
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45 }}>{es ? 'o' : 'or'}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.ink12 }} />
              </View>

              <Pressable
                onPress={onGoogle}
                style={({ pressed }) => [{
                  alignSelf: 'stretch', height: 50, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink,
                  backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                }, pressed && { transform: [{ translateY: 1 }] }]}
              >
                <Ionicons name="logo-google" size={18} color={colors.ink} />
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 15.5, color: colors.ink }}>
                  {es ? 'Continuar con Google' : 'Continue with Google'}
                </Text>
              </Pressable>
            </>
          )}

          {step === 'code' && (
            <>
              <Heading>{es ? 'Revisá tu correo' : 'Check your email'}</Heading>
              <Sub>
                {es
                  ? `Enviamos un código de 6 dígitos a ${email.trim()}.`
                  : `We sent a 6-digit code to ${email.trim()}.`}
              </Sub>

              {mode === 'signup' ? (
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={es ? 'Tu nombre' : 'Your name'}
                  placeholderTextColor={colors.ink45}
                  autoCapitalize="words"
                  textContentType="name"
                  style={[inputStyle, { marginBottom: 12 }]}
                />
              ) : null}

              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="123456"
                placeholderTextColor={colors.ink45}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                style={[inputStyle, { fontFamily: fonts.mono, fontSize: 22, letterSpacing: 6, textAlign: 'center' }]}
              />
              <ErrorText error={error} />
              <Button label={t('verify') || (es ? 'Verificar' : 'Verify')} onPress={verifyCode} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />

              <Pressable onPress={() => sendCode(true)} style={{ alignSelf: 'center', marginTop: 16 }}>
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink60 }}>
                  {resentAt ? (es ? 'Código reenviado' : 'Code resent') : (es ? 'Reenviar código' : 'Resend code')}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setStep('email'); setCode(''); setError(''); }} style={{ alignSelf: 'center', marginTop: 12 }}>
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>
                  {es ? 'Usar otro correo' : 'Use a different email'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
