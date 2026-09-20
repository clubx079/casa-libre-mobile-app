import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { I18nProvider } from '../lib/i18n';
import { CountryProvider } from '../lib/country';
import { AuthProvider } from '../lib/session';
import { colors } from '../lib/theme';
import UpdateGate from '../components/UpdateGate';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CountryProvider>
        <I18nProvider>
         <AuthProvider>
          <StatusBar style="dark" />
          {/* UpdateGate wraps the whole navigator: on startup/foreground it
              enforces the minimum supported native version (blocking wall) and
              surfaces soft update / OTA prompts. Mounted inside the providers so
              it can read the active country (→ origin) and i18n. */}
          <UpdateGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            {/* Transparent modal so the screen BELOW (the marketplace) stays
                mounted and visible behind the page during the pull-down dismiss —
                a plain card/slide_from_bottom route detaches it, leaving a blank
                paper screen + a multi-second remount. The page paints its own
                opaque paper card (see app/property/[id].js). */}
            <Stack.Screen
              name="property/[id]"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen name="empresas" />
            <Stack.Screen name="my-listings" />
            <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
          </Stack>
          </UpdateGate>
         </AuthProvider>
        </I18nProvider>
        </CountryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
