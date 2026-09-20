// Account tab — signed-out promo + quick links, or signed-in profile editor.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, ToastAndroid, Alert, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import MascotLoader from '../../components/MascotLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { useCountry, SUPPORTED, PROFILES } from '../../lib/country';
import { getApiBase } from '../../lib/config';
import Button from '../../components/Button';
import Wordmark from '../../components/Wordmark';
import BottomSheet from '../../components/BottomSheet';

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

// Country switcher — mirrors the web's per-country model. The row shows the
// CURRENTLY selected country and opens a bottom-sheet picker (scales to many
// countries, unlike a row of pills). Persists the choice (AsyncStorage, via
// CountryProvider) and re-renders the whole app against that country.
function CountrySelector() {
  const { code, setCountry } = useCountry();
  const { lang } = useI18n();
  const es = lang !== 'en';
  const [open, setOpen] = useState(false);
  const active = PROFILES[code] || PROFILES.py;

  return (
    <>
      {/* Row: label + the selected country + chevron. Tapping opens the picker. */}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 14, paddingHorizontal: 4,
          borderBottomWidth: 1, borderBottomColor: colors.ink08,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="globe-outline" size={20} color={colors.ink} />
        <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink }}>{es ? 'País' : 'Country'}</Text>
        <Text style={{ fontSize: 17, marginRight: 2 }}>{active.flag}</Text>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginRight: 4 }}>{active.name}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.ink30} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ paddingHorizontal: 18, paddingBottom: 34, paddingTop: 4 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink, marginBottom: 3 }}>
              {es ? 'Elegí tu país' : 'Choose your country'}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink60, marginBottom: 16 }}>
              {es ? 'Verás propiedades y precios de este país.' : "You'll see listings and prices from this country."}
            </Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {SUPPORTED.map((c) => {
                const p = PROFILES[c];
                const on = c === code;
                return (
                  <Pressable
                    key={c}
                    onPress={() => { setCountry(c); setOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8,
                      borderRadius: 16,
                      borderWidth: 1.5, borderColor: on ? colors.ink : colors.ink12,
                      backgroundColor: on ? colors.card : (pressed ? colors.ink08 : 'transparent'),
                    })}
                  >
                    <Text style={{ fontSize: 26 }}>{p.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink }}>{p.name}</Text>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink60, marginTop: 1 }}>
                        {p.capital} · {p.currencyCode}
                      </Text>
                    </View>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={23}
                      color={on ? colors.ink : colors.ink30}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
        </View>
      </BottomSheet>
    </>
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
      const res = await fetch(`${getApiBase()}/api/account/profile`, { credentials: 'include' });
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
      const res = await fetch(`${getApiBase()}/api/account/profile`, {
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
        <MascotLoader />
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
            <CountrySelector />
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
            onPress={() => router.push('/my-listings')}
          />
          <LinkRow icon="business-outline" label={t('empresas')} onPress={() => router.push('/empresas')} />
          <LinkRow icon="chatbox-ellipses-outline" label={t('feedback')} onPress={() => router.push('/feedback')} />
          <CountrySelector />
          <LangToggle />
        </View>

        <Button
          label={t('signOut')}
          variant="outline"
          onPress={signOut}
          icon={<Ionicons name="log-out-outline" size={18} color={colors.ink} />}
          style={{ alignSelf: 'stretch', marginTop: 24, backgroundColor: colors.card }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
