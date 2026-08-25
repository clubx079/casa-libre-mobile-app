// "casa-libre.py" wordmark — "casa-libre" in Space Grotesk bold, ".py" in
// Instrument Serif italic (the brand's signature treatment).
import { Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function Wordmark({ size = 22, color = colors.ink }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: size, color, letterSpacing: -0.5 }}>
        casa-libre
      </Text>
      <Text style={{ fontFamily: fonts.serif, fontSize: size, color, marginLeft: 1 }}>.py</Text>
    </View>
  );
}
