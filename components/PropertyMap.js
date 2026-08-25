// Map of listings with price-pill markers (react-native-maps). Default center
// Asunción; fits to the result set. On web (where react-native-maps is unstable)
// it renders a simple notice instead.
import { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { colors, fonts, radii } from '../lib/theme';
import { shortUsd } from '../lib/format';
import { ASUNCION } from '../lib/config';

// react-native-maps is a native module NOT bundled in Expo Go — only load it in a
// dev/standalone build. In Expo Go (or web) we render a graceful fallback so the
// rest of the app runs fine; the real map appears in an EAS/dev build.
// (SDK 54: executionEnvironment==='storeClient' means Expo Go.)
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const MAPS_UNAVAILABLE = Platform.OS === 'web' || IS_EXPO_GO;

let MapView, Marker;
if (!MAPS_UNAVAILABLE) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
  } catch {
    MapView = null;
  }
}

export default function PropertyMap({ listings = [], style, single = null, onMarkerPress }) {
  const ref = useRef(null);
  const pts = single ? [single] : listings.filter((l) => l.lat && l.lng);

  useEffect(() => {
    if (Platform.OS === 'web' || !ref.current || !pts.length) return;
    const coords = pts.map((l) => ({ latitude: l.lat, longitude: l.lng }));
    if (single) return; // single map uses initialRegion
    const id = setTimeout(() => {
      try { ref.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: false }); } catch {}
    }, 350);
    return () => clearTimeout(id);
  }, [pts.length, single]);

  if (MAPS_UNAVAILABLE || !MapView) {
    return (
      <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center', padding: 20 }, style]}>
        <Text style={{ fontFamily: fonts.mono, color: colors.ink60, fontSize: 12, textAlign: 'center' }}>
          {pts.length} {pts.length === 1 ? 'ubicación' : 'ubicaciones'}{'\n'}Mapa disponible en la build completa
        </Text>
      </View>
    );
  }

  const region = single
    ? { latitude: single.lat, longitude: single.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: ASUNCION.latitude, longitude: ASUNCION.longitude, latitudeDelta: 0.14, longitudeDelta: 0.14 };

  return (
    <View style={style}>
      <MapView ref={ref} style={{ flex: 1 }} initialRegion={region} showsUserLocation showsMyLocationButton={false}>
        {pts.map((l) => (
          <Marker
            key={l.id}
            coordinate={{ latitude: l.lat, longitude: l.lng }}
            onPress={() => (onMarkerPress ? onMarkerPress(l) : router.push(`/property/${l.id}`))}
            tracksViewChanges={false}
          >
            <View style={{ backgroundColor: colors.ink, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.paper }}>
              <Text style={{ color: colors.paper, fontFamily: fonts.monoMed, fontSize: 11 }}>{shortUsd(l.usd)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
