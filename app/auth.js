// Modal auth — email-first flow over the buyer portal's web API (see lib/session).
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
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

export default function Auth() {
  const { t, lang } = useI18n();
  const { refresh } = useAuth();

  const [step, setStep] = useState('email'); // email | login | signup | otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => router.back();

  const onContinue = async () => {
    if (!email.trim()) return;
    setError(''); setLoading(true);
    const { ok, data } = await auth.checkEmail(email.trim());
    setLoading(false);
    if (!ok) { setError(lang === 'en' ? 'Something went wrong' : 'Algo salió mal'); return; }
    setStep(data.exists ? 'login' : 'signup');
  };

  const onGoogle = async () => {
    try {
      const { ok, data } = await auth.googleUrl();
      if (ok && data.url) await WebBrowser.openAuthSessionAsync(data.url);
    } catch {
      // ignore
    }
  };

  const onLogin = async () => {
    setError(''); setLoading(true);
    const { ok, status } = await auth.login(email.trim(), password);
    setLoading(false);
    if (ok) { await refresh(); router.back(); return; }
    if (status === 401 || status === 400) setError('Correo o contraseña incorrectos');
    else setError(lang === 'en' ? 'Something went wrong' : 'Algo salió mal');
  };

  const onSignup = async () => {
    if (password.length < 6) { setError(lang === 'en' ? 'Password must be at least 6 characters' : 'La contraseña debe tener al menos 6 caracteres'); return; }
    setError(''); setLoading(true);
    const { ok, status } = await auth.sendOtp(email.trim(), fullName, phone);
    setLoading(false);
    if (ok) { setStep('otp'); return; }
    if (status === 409) setError('Ese correo ya está registrado');
    else if (status === 429) setError('Esperá un momento e intentá de nuevo');
    else setError(lang === 'en' ? 'Something went wrong' : 'Algo salió mal');
  };

  const onResend = async () => {
    setError('');
    await auth.sendOtp(email.trim(), fullName, phone);
  };

  const onVerify = async () => {
    setError(''); setLoading(true);
    const { ok } = await auth.verifyOtp({ email: email.trim(), code, password, fullName, phone });
    setLoading(false);
    if (ok) { await refresh(); router.back(); return; }
    setError('Código inválido');
  };

  const Heading = ({ children }) => (
    <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink, marginTop: 20, marginBottom: 16, alignSelf: 'stretch' }}>
      {children}
    </Text>
  );

  const ErrorText = () => error ? (
    <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.danger, marginTop: 12, alignSelf: 'stretch' }}>{error}</Text>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Close */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
        <Pressable onPress={close} hitSlop={12} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignItems: 'center' }}>
          <Wordmark size={30} />

          {step === 'email' && (
            <>
              <Heading>{t('signIn')}</Heading>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('email')}
                placeholderTextColor={colors.ink45}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={inputStyle}
              />
              <ErrorText />
              <Button label={lang === 'en' ? 'Continue' : 'Continuar'} onPress={onContinue} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />
              <Button label="Google" variant="outline" onPress={onGoogle} icon={<Ionicons name="logo-google" size={18} color={colors.ink} />} style={{ alignSelf: 'stretch', marginTop: 12 }} />
            </>
          )}

          {step === 'login' && (
            <>
              <Heading>{t('signIn')}</Heading>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink60, alignSelf: 'stretch', marginBottom: 12 }}>{email}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('password')}
                placeholderTextColor={colors.ink45}
                secureTextEntry
                autoCapitalize="none"
                style={inputStyle}
              />
              <ErrorText />
              <Button label={t('signIn')} onPress={onLogin} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />
              <Pressable onPress={() => { setStep('email'); setError(''); setPassword(''); }} style={{ marginTop: 16 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink60 }}>← usar otro correo</Text>
              </Pressable>
            </>
          )}

          {step === 'signup' && (
            <>
              <Heading>{lang === 'en' ? 'Create account' : 'Crear cuenta'}</Heading>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink60, alignSelf: 'stretch', marginBottom: 12 }}>{email}</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={lang === 'en' ? 'Full name' : 'Nombre completo'}
                placeholderTextColor={colors.ink45}
                style={[inputStyle, { marginBottom: 12 }]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={lang === 'en' ? 'Phone' : 'Teléfono'}
                placeholderTextColor={colors.ink45}
                keyboardType="phone-pad"
                style={[inputStyle, { marginBottom: 12 }]}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('password')}
                placeholderTextColor={colors.ink45}
                secureTextEntry
                autoCapitalize="none"
                style={inputStyle}
              />
              <ErrorText />
              <Button label={lang === 'en' ? 'Create account' : 'Crear cuenta'} onPress={onSignup} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />
              <Pressable onPress={() => { setStep('email'); setError(''); }} style={{ marginTop: 16 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink60 }}>← usar otro correo</Text>
              </Pressable>
            </>
          )}

          {step === 'otp' && (
            <>
              <Heading>{lang === 'en' ? 'Verify your email' : 'Verificá tu correo'}</Heading>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink60, alignSelf: 'stretch', marginBottom: 12 }}>
                {lang === 'en' ? 'Enter the 6-digit code we sent to' : 'Ingresá el código de 6 dígitos que enviamos a'} {email}
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="••••••"
                placeholderTextColor={colors.ink45}
                keyboardType="numeric"
                maxLength={6}
                style={[inputStyle, { fontFamily: fonts.mono, fontSize: 22, letterSpacing: 8, textAlign: 'center' }]}
              />
              <ErrorText />
              <Button label={lang === 'en' ? 'Verify' : 'Verificar'} onPress={onVerify} loading={loading} style={{ alignSelf: 'stretch', marginTop: 16 }} />
              <Pressable onPress={onResend} style={{ marginTop: 16 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink60 }}>Reenviar código</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
