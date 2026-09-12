import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import MascotLoader from '../../components/MascotLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useFavorites } from '../../lib/favorites';
import { fetchListingsByIds } from '../../lib/listings';
import PropertyCard from '../../components/PropertyCard';

export default function Saved() {
  const { t } = useI18n();
  const ids = useFavorites();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ids.length) { setListings([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { listings } = await fetchListingsByIds(ids);
      setListings(listings);
    } catch { setListings([]); }
    setLoading(false);
  }, [ids.join(',')]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink }}>{t('saved')}</Text>
      </View>
      {loading ? (
        <MascotLoader />
      ) : listings.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <Ionicons name="heart-outline" size={44} color={colors.ink30} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink60, textAlign: 'center' }}>{t('noFavorites')}</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => <PropertyCard listing={item} />}
        />
      )}
    </SafeAreaView>
  );
}
