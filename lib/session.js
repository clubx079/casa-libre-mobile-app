// Auth via the buyer portal's existing web API. React Native's native networking
// keeps the httpOnly `cl_session` cookie in its own cookie jar and re-sends it
// automatically, so no token handling is needed on native. (On web target the
// cross-origin cookie won't stick — native is the primary target.)
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getApiBase } from './config';

async function post(path, body) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const auth = {
  checkEmail: (email) => post('/api/auth/check-email', { email }),
  login: (email, password) => post('/api/auth/login', { email, password }),
  sendOtp: (email, fullName, phone) => post('/api/auth/send-otp', { email, fullName, phone }),
  // Passwordless sign-in: one pair of endpoints for both new and returning people.
  // `send` replies { mode: 'login' | 'signup' } so the screen knows whether to ask
  // for a name as well; `verify` starts the session either way — no password.
  sendCode: (email, fullName) => post('/api/auth/code/send', { email, fullName }),
  verifyCode: (payload) => post('/api/auth/code/verify', payload),
  verifyOtp: (payload) => post('/api/auth/verify-otp', payload),
  logout: () => post('/api/auth/logout', {}),
  // mobileRedirect = the app's deep-link return URL (casalibre://auth). The callback
  // sends the session token back to it; mobileExchange turns that token into the cookie.
  googleUrl: (mobileRedirect) => post('/api/auth/google', { mobileRedirect }),
  mobileExchange: (token) => post('/api/auth/mobile-exchange', { token }),
  // Get a one-shot URL that logs the system browser in and lands on `next`
  // (used to open the web "promote my listing" page already signed in).
  handoff: (next) => post('/api/auth/handoff', { next }),
  async me() {
    try {
      const res = await fetch(`${getApiBase()}/api/auth/me`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return data.user || null;
    } catch { return null; }
  },
};

const AuthContext = createContext({ user: null, loading: true, refresh: () => {}, signOut: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = await auth.me();
    setUser(u);
    setLoading(false);
    return u;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
