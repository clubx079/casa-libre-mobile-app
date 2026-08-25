// Diagonal-hatch placeholder with a mono "[ foto ]" label — shown when a listing
// has no image (mirrors the web noImg treatment).
import { View, Text } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function Hatch({ style, label = '[ foto ]' }) {
  // Approximate the CSS repeating diagonal hatch with a few offset stripes.
  return (
    <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <View style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute', left: -60 + i * 26, top: -40, width: 8, height: 600,
              backgroundColor: 'rgba(17,17,17,0.05)', transform: [{ rotate: '45deg' }],
            }}
          />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink45, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
