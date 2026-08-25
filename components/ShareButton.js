// Share a listing via the OS share sheet.
import { Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MEDIA_BASE } from '../lib/config';
import { colors } from '../lib/theme';

export default function ShareButton({ listing, size = 20, circle = true }) {
  const onShare = async () => {
    const url = `https://casa-libre.com.py/propiedad/${listing.id}`;
    const title = listing.title || `${listing.type || 'Propiedad'} · ${listing.neighborhood || listing.city || ''}`.trim();
    try {
      await Share.share({ message: `${title}\n${url}`, url, title });
    } catch {}
  };
  return (
    <Pressable
      onPress={onShare}
      hitSlop={10}
      style={{
        width: circle ? 38 : undefined, height: circle ? 38 : undefined, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: circle ? '#fff' : 'transparent',
        borderWidth: circle ? 1 : 0, borderColor: colors.ink12,
      }}
    >
      <Ionicons name="share-outline" size={size} color={colors.ink} />
    </Pressable>
  );
}
