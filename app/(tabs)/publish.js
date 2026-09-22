// Publish — the app does not collect listings itself. Tapping Publish opens the
// LISTING WIZARD on the website in the system browser, and everything (the form,
// the photos, the account, any paid visibility) happens there.
//
// Why: the app stays a free browse-and-save product, which keeps it clear of the
// stores' rules on selling digital goods in-app, and we maintain one listing flow
// instead of two.
//
// Two cases, both handled here:
//  · signed in  → /api/auth/handoff mints a one-shot URL so the browser opens the
//    wizard already signed in; the wizard then skips name, email and the code.
//  · signed out → we open the wizard plainly; the person verifies their email there.
//    On success the web sends us back to casalibre://auth?token=… which we exchange
//    for the app's own session — so they return to the app already signed in, with
//    the new listing in My listings.
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { auth } from '../../lib/session';
import { getApiBase } from '../../lib/config';

const WIZARD_PATH = '/?sell=1&app=1';

export default function Publish() {
  const { t, lang } = useI18n();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const es = lang !== 'en';

  // Coming back from the browser: pick up any session the web handed over.
  useFocusEffect(useCallback(() => { refresh && refresh(); }, [refresh])); // eslint-disable-line react-hooks/exhaustive-deps

  const openWizard = async () => {
    if (busy) return;
    setBusy(true);
    const base = getApiBase();
    let url = `${base}${WIZARD_PATH}`;
    try {
      // Signed in → carry the session into the browser so the wizard can skip ahead.
      if (user) {
        const { ok, data } = await auth.handoff(WIZARD_PATH);
        if (ok && data?.url) url = data.url;
      }
      const redirect = ExpoLinking.createURL('auth');   // casalibre://auth in a build
      const res = await WebBrowser.openAuthSessionAsync(url, redirect);
      // The web's "back to the app" button returns here carrying the session.
      if (res?.type === 'success' && res.url) {
        const q = ExpoLinking.parse(res.url).queryParams || {};
        if (q.token) { await auth.mobileExchange(String(q.token)); }
        await (refresh ? refresh() : Promise.resolve());
        if (q.listing) router.push(`/property/${q.listing}`);
        else router.push('/my-listings');
        return;
      }
      // Dismissed: they may still have published and signed in on the web.
      await (refresh ? refresh() : Promise.resolve());
    } catch {
      try { await Linking.openURL(`${base}${WIZARD_PATH}`); } catch { /* nothing else to try */ }
    } finally {
      setBusy(false);
    }
  };

  const steps = es
    ? ['Contanos qué vendés o alquilás', 'Marcá la dirección en el mapa', 'Subí fotos y poné el precio', 'Listo: tu aviso queda publicado gratis']
    : ['Tell us what you are selling or renting', 'Drop the address on the map', 'Add photos and the price', "Done — your listing is live, free"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 12 }}>
        <Image source={require('../../assets/mascot.png')} style={{ width: 96, height: 96, alignSelf: 'center' }} contentFit="contain" />

        <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink, textAlign: 'center', marginTop: 8 }}>
          {es ? 'Publicá tu propiedad gratis' : 'List your property for free'}
        </Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink60, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          {es
            ? 'Te llevamos al formulario en el navegador. Sin comisión y sin planes: tu aviso queda publicado al instante.'
            : 'We take you to the form in your browser. No commission, no plans — your listing goes live instantly.'}
        </Text>

        <View style={{ marginTop: 22, gap: 12 }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: colors.paper }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.ink70 }}>{s}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={openWizard}
          disabled={busy}
          style={({ pressed }) => [{
            marginTop: 26, height: 54, borderRadius: radii.pill, backgroundColor: colors.ink,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...hardShadow,
            opacity: busy ? 0.7 : 1,
          }, pressed && { transform: [{ translateY: 1 }] }]}
        >
          {busy ? <ActivityIndicator color={colors.paper} /> : <Ionicons name="open-outline" size={19} color={colors.paper} />}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.paper }}>
            {es ? 'Publicar en el navegador' : 'Continue in the browser'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/my-listings')} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.sansMed, fontSize: 14.5, color: colors.ink, textDecorationLine: 'underline' }}>
            {t('myListings')}
          </Text>
        </Pressable>

        {!user ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink45, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
            {es
              ? 'Si todavía no tenés cuenta, la creás en el mismo formulario con un código que te enviamos por correo. Al volver a la app ya vas a estar dentro.'
              : "If you don't have an account yet, you create it in the same form with a code we email you. You'll be signed in when you come back to the app."}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
