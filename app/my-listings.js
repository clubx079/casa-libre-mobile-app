// My listings — the user's own published properties (login-gated). Reads
// /api/account/listings; supports deleting one's own listing.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import MascotLoader from '../components/MascotLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/session';
import { getApiBase, getMediaBase } from '../lib/config';
import PropertyCard from '../components/PropertyCard';
import Button from '../components/Button';

const abs = (u) => (!u ? null : u.startsWith('http') ? u : getMediaBase() + (u.startsWith('/') ? u : '/' + u));
const fixImages = (l) => ({ ...l, image: abs(l.image), images: Array.isArray(l.images) ? l.images.map(abs).filter(Boolean) : [] });

const STATUS_LABEL = { active: 'Activa', pending: 'En revisión', paused: 'Pausada', rejected: 'Rechazada', delisted: 'Dada de baja' };

export default function MyListings() {
  const { t, lang } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/account/listings`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      setRows((data.listings || []).map(fixImages));
    } catch { setRows([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const del = (id) => {
    Alert.alert(
      lang === 'en' ? 'Delete listing?' : '¿Eliminar publicación?',
      lang === 'en' ? 'This cannot be undone.' : 'Esta acción no se puede deshacer.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: lang === 'en' ? 'Delete' : 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${getApiBase()}/api/account/listings`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
              setRows((prev) => prev.filter((r) => r.id !== id));
            } catch {}
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{t('myListings')}</Text>
      </View>

      {authLoading || loading ? (
        <MascotLoader />
      ) : !user ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ fontFamily: fonts.sans, color: colors.ink60, textAlign: 'center' }}>{t('signInToPublish')}</Text>
          <View style={{ alignSelf: 'stretch' }}><Button label={t('signIn')} onPress={() => router.push('/auth')} /></View>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 }}>
          <Ionicons name="home-outline" size={44} color={colors.ink30} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink60, textAlign: 'center' }}>
            {lang === 'en' ? "You haven't published any properties yet." : 'Todavía no publicaste ninguna propiedad.'}
          </Text>
          <View style={{ alignSelf: 'stretch' }}><Button label={t('listForFree')} onPress={() => router.push('/publish')} /></View>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 16 }}>
              <PropertyCard listing={item} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -8, paddingHorizontal: 4 }}>
                <View style={{ backgroundColor: colors.ink08, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink70 }}>
                    {STATUS_LABEL[item.admin_status] || item.admin_status || (lang === 'en' ? 'Active' : 'Activa')}
                  </Text>
                </View>
                <Pressable onPress={() => del(item.id)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={{ fontFamily: fonts.sansMed, fontSize: 13, color: colors.danger }}>{lang === 'en' ? 'Delete' : 'Eliminar'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
