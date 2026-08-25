// Saved / favorite listings — persisted per-device via AsyncStorage.
// (The web app stores favorites server-side once logged in; on mobile we keep a
// local set that works logged-out and can later be synced.)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'cl.favorites.v1';
let cache = null;
const listeners = new Set();

async function load() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    cache = new Set();
  }
  return cache;
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...cache]));
  } catch {}
  listeners.forEach((fn) => fn());
}

export async function toggleFavorite(id) {
  await load();
  if (cache.has(id)) cache.delete(id);
  else cache.add(id);
  await persist();
  return cache.has(id);
}

export async function getFavorites() {
  await load();
  return [...cache];
}

// Hook: returns [isFav, toggle] for one id, and re-renders on change.
export function useFavorite(id) {
  const [fav, setFav] = useState(false);
  useEffect(() => {
    let alive = true;
    load().then(() => alive && setFav(cache.has(id)));
    const fn = () => alive && setFav(cache.has(id));
    listeners.add(fn);
    return () => { alive = false; listeners.delete(fn); };
  }, [id]);
  const toggle = useCallback(() => toggleFavorite(id), [id]);
  return [fav, toggle];
}

// Hook: the full set of favorite ids (for the Saved tab).
export function useFavorites() {
  const [ids, setIds] = useState([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => load().then(() => alive && setIds([...cache]));
    refresh();
    listeners.add(refresh);
    return () => { alive = false; listeners.delete(refresh); };
  }, []);
  return ids;
}
