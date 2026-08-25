// Account tab — signed-out promo + quick links, or signed-in profile editor.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, ToastAndroid, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { API_BASE } from '../../lib/config';
import Button from '../../components/Button';
import Wordmark from '../../components/Wordmark';

function toast(msg) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

function LinkRow({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 4,
        borderBottomWidth: 1, borderBottomColor: colors.ink08,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
      <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.ink30} />
    </Pressable>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="language-outline" size={20} color={colors.ink} />
        <Text style={{ fontFamily: fonts.sans, fontSize: 16, color: colors.ink }}>Idioma / Language</Text>
      </View>
      <Pressable onPress={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
        {['ES', 'EN'].map((L) => {
          const on = (L === 'ES') === (lang === 'es');
          return <Text key={L} style={{ paddingHorizontal: 12, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 12, color: on ? colors.paper : colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>{L}</Text>;
        })}
      </Pressable>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1.5, borderColor: colors.ink12, borderRadius: 14,
  padding: 12, fontFamily: fonts.sans, fontSize: 16, color: colors.ink,
  backgroundColor: colors.card,
};

export default function Account() {
  const { t, lang } = useI18n();
  const es = lang !== 'en';
  const { user, loading, signOut } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/account/profile`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const p = data.profile || data || {};
      setFullName(p.full_name || user.full_name || '');
      setPhone(p.phone || '');
    } catch {
      setFullName(user.full_name || '');
      setPhone('');
    }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      if (res.ok) toast(lang === 'en' ? 'Saved' : 'Guardado');
      else toast(lang === 'en' ? 'Could not save' : 'No se pudo guardar');
    } catch {
      toast(lang === 'en' ? 'Could not save' : 'No se pudo guardar');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></View>
      </SafeAreaView>
    );
  }

  // Signed out
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingTop: 32, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={{ alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <Wordmark size={30} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink60, textAlign: 'center' }}>
                {t('signInToSave')}
              </Text>
              <Button label={t('signIn')} onPress={() => router.push('/auth')} style={{ alignSelf: 'stretch', marginTop: 4 }} />
            </View>

            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              {es ? 'Más' : 'More'}
            </Text>
            <LinkRow icon="business-outline" label={t('empresas')} onPress={() => router.push('/empresas')} />
            <LinkRow icon="chatbox-ellipses-outline" label={t('feedback')} onPress={() => router.push('/feedback')} />
            <LangToggle />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Signed in
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink }}>
            {user.full_name || user.email}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink60, marginTop: 2 }}>
            {user.email}
          </Text>
        </View>

        {/* Profile editor */}
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink45, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          {t('profile')}
        </Text>

        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, marginBottom: 6 }}>
          {es ? 'Nombre' : 'Name'}
        </Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder={es ? 'Tu nombre' : 'Your name'}
          placeholderTextColor={colors.ink45}
          style={[inputStyle, { marginBottom: 14 }]}
        />

        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, marginBottom: 6 }}>
          {t('phone')}
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={es ? 'Tu teléfono' : 'Your phone'}
          placeholderTextColor={colors.ink45}
          keyboardType="phone-pad"
          style={[inputStyle, { marginBottom: 16 }]}
        />

        <Button label={t('save')} onPress={save} loading={saving} style={{ alignSelf: 'flex-start' }} />

        {/* Links */}
        <View style={{ marginTop: 32 }}>
          <LinkRow
            icon="albums-outline"
            label={t('myListings')}
            onPress={() => Alert.alert(t('comingSoon'))}
          />
          <LinkRow icon="business-outline" label={t('empresas')} onPress={() => router.push('/empresas')} />
          <LinkRow icon="chatbox-ellipses-outline" label={t('feedback')} onPress={() => router.push('/feedback')} />
          <LangToggle />
        </View>

        <Button
          label={t('signOut')}
          variant="outline"
          onPress={signOut}
          style={{ alignSelf: 'stretch', marginTop: 24 }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
