// "casa-libre" wordmark — Space Grotesk bold (the brand's signature treatment).
// The ".py" suffix was removed so the brand reads simply "casa-libre".
import { Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function Wordmark({ size = 22, color = colors.ink }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: size, color, letterSpacing: -0.5 }}>
        casa-libre
      </Text>
    </View>
  );
}
