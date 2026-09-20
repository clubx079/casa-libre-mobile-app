// ─────────────────────────────────────────────────────────────────────────────
// UpdateGate — wraps the whole app and enforces our two-layer update strategy.
//
//   LAYER A  Native "minimum supported version" gate.
//     On startup (and on every foreground) we ask the buyer portal what the
//     minimum-required native version is. If the installed binary is older, we
//     show a FULL-SCREEN, NON-DISMISSIBLE "Update required" wall whose only
//     action opens the App Store / Play Store. If the binary is merely behind
//     `latestVersion` (but at/above the floor) we show a dismissible
//     "update available" prompt instead.
//
//   LAYER B  OTA JS updates via expo-updates (JS-only fixes without a store
//     round-trip). expo-updates is NOT installed yet, so this layer is behind
//     the OTA_ENABLED flag and a commented import — see runOtaCheck() below for
//     the one-time enable steps. It no-ops in Expo Go / dev.
//
// FAIL-OPEN: a fetch/parse failure never blocks the user (see lib/appVersion.js).
// The gate renders `children` at all times and overlays modals on top, so the UI
// tree below stays mounted.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import Button from './Button';
import { useI18n } from '../lib/i18n';
import { useCountry } from '../lib/country';
import { colors, fonts, radii, hardShadow, space } from '../lib/theme';
import {
  fetchAppVersionConfig,
  getInstalledVersion,
  isBelow,
  defaultStoreUrl,
} from '../lib/appVersion';

// ── LAYER B toggle ───────────────────────────────────────────────────────────
// Flip to true AFTER: `npx expo install expo-updates`, adding an `updates` +
// `runtimeVersion` block to app.json, and uncommenting the import below. Kept
// false so the app bundles today without the dependency.
const OTA_ENABLED = false;
// import * as Updates from 'expo-updates';   // ← uncomment when OTA_ENABLED

export default function UpdateGate({ children }) {
  const { t } = useI18n();
  const { code } = useCountry(); // re-check if the active country (→ origin) changes

  // Hard gate
  const [blocked, setBlocked] = useState(false);
  // Soft "update available" prompt
  const [softOpen, setSoftOpen] = useState(false);
  const [storeUrl, setStoreUrl] = useState(defaultStoreUrl());
  // OTA "update ready, restart" prompt
  const [otaReady, setOtaReady] = useState(false);

  // Don't re-nag for the same soft version within a session.
  const dismissedSoft = useRef(null);

  const openStore = useCallback(() => {
    Linking.openURL(storeUrl).catch(() => {});
  }, [storeUrl]);

  // ── Layer A: min-version check ─────────────────────────────────────────────
  const runVersionCheck = useCallback(async () => {
    const cfg = await fetchAppVersionConfig();
    if (!cfg) return; // fail open (offline / bad response)
    if (cfg.storeUrl) setStoreUrl(cfg.storeUrl);

    const installed = getInstalledVersion();

    if (isBelow(installed, cfg.minVersion)) {
      setBlocked(true); // hard wall — sticky until they update
      return;
    }
    // At/above the floor: offer the soft prompt if a newer version exists and we
    // haven't already dismissed that exact version this session.
    if (
      isBelow(installed, cfg.latestVersion) &&
      dismissedSoft.current !== cfg.latestVersion
    ) {
      setSoftOpen(true);
    }
  }, []);

  // ── Layer B: OTA JS update check (guarded / no-op until enabled) ────────────
  const runOtaCheck = useCallback(async () => {
    if (!OTA_ENABLED) return;
    try {
      // if (!Updates.isEnabled || __DEV__ || Updates.channel == null) return; // Expo Go / dev
      // const res = await Updates.checkForUpdateAsync();
      // if (res.isAvailable) {
      //   await Updates.fetchUpdateAsync();
      //   setOtaReady(true); // prompt the user to restart (see modal below)
      // }
    } catch {
      // swallow — OTA is best-effort, never blocks the app
    }
  }, []);

  const restartForOta = useCallback(async () => {
    if (!OTA_ENABLED) return;
    try {
      // await Updates.reloadAsync();
    } catch {}
  }, []);

  // Run on mount, when the country/origin changes, and on every foreground.
  useEffect(() => {
    runVersionCheck();
    runOtaCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        runVersionCheck();
        runOtaCheck();
      }
    });
    return () => sub.remove();
  }, [code, runVersionCheck, runOtaCheck]);

  const dismissSoft = useCallback(() => {
    setSoftOpen(false);
    // remember the version we're dismissing so we don't nag again this session
    fetchAppVersionConfig().then((cfg) => {
      if (cfg?.latestVersion) dismissedSoft.current = cfg.latestVersion;
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* ── HARD GATE: full-screen, non-dismissible ── */}
      <Modal
        visible={blocked}
        animationType="fade"
        transparent={false}
        // No-op so Android hardware-back can't escape the wall.
        onRequestClose={() => {}}
        statusBarTranslucent
      >
        <View style={styles.wall}>
          <View style={styles.card}>
            <Text style={styles.badge}>CASA LIBRE</Text>
            <Text style={styles.title}>{t('updateRequiredTitle')}</Text>
            <Text style={styles.body}>{t('updateRequiredBody')}</Text>
            <Button label={t('updateNow')} onPress={openStore} style={{ marginTop: space(5) }} />
          </View>
        </View>
      </Modal>

      {/* ── SOFT PROMPT: dismissible "update available" ── */}
      <Modal
        visible={softOpen && !blocked}
        animationType="slide"
        transparent
        onRequestClose={dismissSoft}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('updateAvailableTitle')}</Text>
            <Text style={styles.body}>{t('updateAvailableBody')}</Text>
            <Button label={t('updateNow')} onPress={openStore} style={{ marginTop: space(4) }} />
            <Pressable onPress={dismissSoft} style={styles.later} hitSlop={8}>
              <Text style={styles.laterText}>{t('updateLater')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── OTA READY: dismissible "restart to apply" (Layer B) ── */}
      <Modal
        visible={otaReady && !blocked}
        animationType="slide"
        transparent
        onRequestClose={() => setOtaReady(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('otaReadyTitle')}</Text>
            <Text style={styles.body}>{t('otaReadyBody')}</Text>
            <Button label={t('otaRestart')} onPress={restartForOta} style={{ marginTop: space(4) }} />
            <Pressable onPress={() => setOtaReady(false)} style={styles.later} hitSlop={8}>
              <Text style={styles.laterText}>{t('updateLater')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  wall: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: space(6),
    ...hardShadow,
  },
  badge: {
    fontFamily: fonts.monoMed,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.ink45,
    marginBottom: space(3),
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.ink,
    marginBottom: space(2),
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink70,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: space(6),
    paddingBottom: space(9),
  },
  later: {
    alignSelf: 'center',
    marginTop: space(4),
    paddingVertical: space(2),
  },
  laterText: {
    fontFamily: fonts.sansMed,
    fontSize: 14,
    color: colors.ink60,
    textDecorationLine: 'underline',
  },
};
