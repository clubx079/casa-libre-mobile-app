// Heart toggle — persists to the local favorites store.
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { useFavorite } from '../lib/favorites';

export default function SaveButton({ id, variant = 'card', size = 20 }) {
  const [fav, toggle] = useFavorite(id);
  const circle = variant === 'card';
  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      style={{
        width: circle ? 38 : undefined,
        height: circle ? 38 : undefined,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: circle ? '#fff' : 'transparent',
        borderWidth: circle ? 1 : 0,
        borderColor: colors.ink12,
      }}
    >
      <Ionicons name={fav ? 'heart' : 'heart-outline'} size={size} color={colors.ink} />
    </Pressable>
  );
}
