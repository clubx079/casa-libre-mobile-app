// Publish — not a screen, a jump. Tapping the tab opens the LISTING WIZARD on the
// website in the system browser and everything (form, photos, account, any paid
// visibility) happens there.
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
import { useCallback, useRef } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '../../lib/theme';
import { useAuth, auth } from '../../lib/session';
import { getApiBase } from '../../lib/config';

const WIZARD_PATH = '/?sell=1&app=1';

export default function Publish() {
  const { user, refresh } = useAuth();
  const runningRef = useRef(false);

  const go = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const base = getApiBase();
    let url = `${base}${WIZARD_PATH}`;
    try {
      // Signed in → carry the session into the browser so the wizard skips ahead.
      if (user) {
        const { ok, data } = await auth.handoff(WIZARD_PATH);
        if (ok && data?.url) url = data.url;
      }
      // A PLAIN browser, deliberately: openAuthSessionAsync makes iOS show the
      // "«Expo» wants to use casa-libre.com.py to sign in" prompt first. The web's
      // "back to the app" button returns to casalibre://auth, which AuthDeepLink
      // picks up (exchanges the session, closes the browser, routes on).
      await WebBrowser.openBrowserAsync(url, { showTitle: false, toolbarColor: colors.paper });
      // Browser closed without the return link: they may still have published.
      if (refresh) await refresh();
      router.replace('/(tabs)');
    } catch {
      try { await Linking.openURL(`${base}${WIZARD_PATH}`); } catch { /* nothing else to try */ }
      router.replace('/(tabs)');
    } finally {
      runningRef.current = false;
    }
  }, [user, refresh]);

  // The tab IS the action: open the browser as soon as it gets focus.
  useFocusEffect(useCallback(() => { go(); }, [go]));

  // Only ever on screen for the instant before the browser takes over.
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Image source={require('../../assets/mascot.png')} style={{ width: 84, height: 84 }} contentFit="contain" />
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}
