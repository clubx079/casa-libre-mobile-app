// Casa Libre pill button. Variants: solid (ink), outline, whatsapp (green).
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors, fonts, radii, hardShadow } from '../lib/theme';

export default function Button({
  label, onPress, variant = 'solid', icon = null, loading = false, disabled = false, style, small = false,
}) {
  const base = {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: radii.pill,
    paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 16 : 22,
    borderWidth: 1.5, borderColor: colors.ink,
  };
  const skins = {
    solid: { backgroundColor: colors.ink },
    outline: { backgroundColor: 'transparent' },
    whatsapp: { backgroundColor: colors.whatsapp, borderColor: colors.ink },
    paper: { backgroundColor: colors.paper },
  };
  const textColor = variant === 'solid' ? colors.paper : variant === 'whatsapp' ? '#fff' : colors.ink;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        base, skins[variant], hardShadow,
        { opacity: disabled ? 0.5 : 1, transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }] },
        pressed && { shadowOffset: { width: 1, height: 1 } },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={{ fontFamily: fonts.sansMed, fontSize: small ? 14 : 16, color: textColor }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
