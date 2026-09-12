// Small loading indicator — the walking Casa Libre house mascot.
// The asset is an OPAQUE animated WebP whose background was recolored to the app
// paper (#f9f4ee): opaque frames can't ghost, and paper-on-paper means no visible
// square. One clean 30-frame run cycle → seamless loop. Sized like a spinner.
import { View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../lib/theme';

export default function MascotLoader({ size = 76, style }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }, style]}>
      <Image
        source={require('../assets/mascot-clean.webp')}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}
