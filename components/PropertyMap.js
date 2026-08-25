// Map of listings with price-pill markers (react-native-maps). Default center
// Asunción; fits to the result set. On web (where react-native-maps is unstable)
// it renders a simple notice instead.
import { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radii } from '../lib/theme';
import { shortUsd } from '../lib/format';
import { ASUNCION } from '../lib/config';

let MapView, Marker;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
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

  if (Platform.OS === 'web') {
    return (
      <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ fontFamily: fonts.mono, color: colors.ink60 }}>Mapa disponible en la app móvil</Text>
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
