// Catches casalibre://auth?token=…&listing=… — the link the website sends us to
// after someone publishes (or signs in) in the browser.
//
// Why a listener and not openAuthSessionAsync: that API makes iOS show the
// "«Expo» wants to use casa-libre.com.py to sign in" confirmation before the
// browser even opens. Opening a plain browser skips that prompt, and the custom
// scheme still brings the person back here — we just have to listen for it and
// close the browser ourselves.
import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { auth, useAuth } from '../lib/session';

export default function AuthDeepLink() {
  const { refresh } = useAuth();
  const handledRef = useRef('');

  useEffect(() => {
    let alive = true;

    const handle = async (url) => {
      if (!url || !alive || handledRef.current === url) return;
      const parsed = Linking.parse(url);
      // only our own auth return, nothing else the app might be opened with
      if (!/(^|\/)auth\/?$/.test(`/${parsed.path || ''}`)) return;
      handledRef.current = url;

      const { token, listing } = parsed.queryParams || {};
      try { await WebBrowser.dismissBrowser(); } catch { /* already closed */ }
      if (token) {
        try { await auth.mobileExchange(String(token)); } catch { /* keep going: refresh will tell us */ }
      }
      if (refresh) await refresh();
      if (listing) router.replace(`/property/${listing}`);
      else if (token) router.replace('/my-listings');
    };

    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    Linking.getInitialURL().then(handle).catch(() => {});
    return () => { alive = false; sub.remove(); };
  }, [refresh]);

  return null;
}
