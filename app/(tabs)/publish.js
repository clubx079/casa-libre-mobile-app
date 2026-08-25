// Publish (list a property) tab — login-gated single-page form mirroring the web
// /publicar flow. Native only (multipart upload with the httpOnly cl_session cookie).
import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { colors, fonts, radii, hardShadow } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { API_BASE } from '../../lib/config';
import Button from '../../components/Button';

const MODES = [
  { k: 'venta', es: 'Venta', en: 'Sale' },
  { k: 'alquiler', es: 'Alquiler', en: 'Rent' },
];
const TYPES = [
  { k: 'casa', es: 'Casa', en: 'House' },
  { k: 'departamento', es: 'Departamento', en: 'Apartment' },
  { k: 'duplex', es: 'Dúplex', en: 'Duplex' },
  { k: 'terreno', es: 'Terreno', en: 'Land' },
];

export default function Publish() {
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const EN = lang === 'en';

  // form state
  const [mode, setMode] = useState('venta');
  const [ptype, setPtype] = useState('casa');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Asunción');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('US$'); // US$ | ₲
  const [area, setArea] = useState('');
  const [contactName, setContactName] = useState(user?.full_name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]); // [{ uri }]

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { ref }

  // ---- loading / gate ----
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
          <Ionicons name="home-outline" size={44} color={colors.ink30} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink, textAlign: 'center' }}>
            {EN ? 'Sign in to list for free' : 'Iniciá sesión para publicar gratis'}
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Button label={t('signIn')} onPress={() => router.push('/auth')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---- success ----
  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Ionicons name="checkmark-circle-outline" size={52} color={colors.success} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink }}>
            {EN ? 'Done' : 'Listo'}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink60 }}>
            {t('ref')}: {done.ref}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
            <Button
              label={EN ? 'View my listings' : 'Ver mis publicaciones'}
              onPress={() => Alert.alert(EN ? 'Coming soon' : 'Próximamente')}
            />
            <Button label={EN ? 'List another' : 'Publicar otra'} variant="outline" onPress={resetForm} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function resetForm() {
    setMode('venta');
    setPtype('casa');
    setNeighborhood('');
    setCity('Asunción');
    setPrice('');
    setCurrency('US$');
    setArea('');
    setContactName(user?.full_name || '');
    setContactPhone('');
    setDescription('');
    setPhotos([]);
    setError('');
    setDone(null);
  }

  async function addPhotos() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 20,
      });
      if (res.canceled) return;
      const picked = (res.assets || []).map((a) => ({ uri: a.uri }));
      setPhotos((prev) => [...prev, ...picked].slice(0, 20));
    } catch {
      // ignore picker errors
    }
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    const digits = (contactPhone || '').replace(/\D/g, '');
    const priceNum = Number((price || '').replace(/[^\d.]/g, ''));
    const areaNum = Number((area || '').replace(/[^\d.]/g, ''));

    if (!neighborhood.trim()) return EN ? 'Enter the neighborhood.' : 'Ingresá el barrio.';
    if (!city.trim()) return EN ? 'Enter the city.' : 'Ingresá la ciudad.';
    if (!priceNum) return EN ? 'Enter a valid price.' : 'Ingresá un precio válido.';

    if (mode === 'venta') {
      if (currency === 'US$' && priceNum < 5000) return EN ? 'Sale price must be at least US$5,000.' : 'El precio de venta debe ser al menos US$5.000.';
    } else {
      if (currency === '₲' && priceNum < 300000) return EN ? 'Rent must be at least ₲300,000/mo.' : 'El alquiler debe ser al menos ₲300.000/mes.';
    }

    if (ptype !== 'terreno') {
      if (!areaNum || areaNum < 5 || areaNum > 2000) return EN ? 'Area must be between 5 and 2000 m².' : 'La superficie debe estar entre 5 y 2000 m².';
    }

    if (digits.length < 6) return EN ? 'Enter a valid phone number.' : 'Ingresá un teléfono válido.';
    if (photos.length < 1) return EN ? 'Add at least one photo.' : 'Agregá al menos una foto.';
    return '';
  }

  async function submit() {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('mode', mode);
      fd.append('ptype', ptype);
      fd.append('neighborhood', neighborhood.trim());
      fd.append('city', city.trim());
      fd.append('price', String(Number((price || '').replace(/[^\d.]/g, ''))));
      fd.append('currency', currency === '₲' ? 'PYG' : 'USD');
      fd.append('area', String(Number((area || '').replace(/[^\d.]/g, '')) || 0));
      fd.append('description', description.trim());
      fd.append('contact_name', contactName.trim());
      fd.append('contact_phone', (contactPhone || '').replace(/\D/g, ''));
      photos.forEach((a, i) => {
        fd.append('photos', { uri: a.uri, name: `photo${i}.jpg`, type: 'image/jpeg' });
      });

      const res = await fetch(`${API_BASE}/api/publish`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.ref || data.ok)) {
        setDone({ ref: data.ref || 'CL-…' });
      } else {
        setError((data && data.error) || (EN ? 'Could not publish. Try again.' : 'No se pudo publicar. Intentá de nuevo.'));
      }
    } catch {
      setError(EN ? 'Network error. Try again.' : 'Error de red. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- small UI helpers ----
  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.ink12,
    borderRadius: 14,
    padding: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  };

  const Label = ({ children }) => (
    <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: colors.ink60, marginBottom: 6, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );

  const Chip = ({ active, label, onPress }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5,
        borderColor: active ? colors.ink : colors.ink30,
        backgroundColor: active ? colors.ink : colors.card, marginRight: 8, marginBottom: 8,
      }}
    >
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: active ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );

  const Field = ({ children }) => <View style={{ marginBottom: 16 }}>{children}</View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'form'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        renderItem={() => (
          <View>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink, marginBottom: 20 }}>
              {t('listForFree')}
            </Text>

            {/* Mode */}
            <Field>
              <Label>{EN ? 'Operation' : 'Operación'}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {MODES.map((m) => (
                  <Chip key={m.k} active={mode === m.k} label={EN ? m.en : m.es} onPress={() => setMode(m.k)} />
                ))}
              </View>
            </Field>

            {/* Type */}
            <Field>
              <Label>{t('type')}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {TYPES.map((ty) => (
                  <Chip key={ty.k} active={ptype === ty.k} label={EN ? ty.en : ty.es} onPress={() => setPtype(ty.k)} />
                ))}
              </View>
            </Field>

            {/* Neighborhood */}
            <Field>
              <Label>{EN ? 'Neighborhood' : 'Barrio'}</Label>
              <TextInput
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholder={EN ? 'e.g. Villa Morra' : 'ej. Villa Morra'}
                placeholderTextColor={colors.ink45}
                style={inputStyle}
              />
            </Field>

            {/* City */}
            <Field>
              <Label>{EN ? 'City' : 'Ciudad'}</Label>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Asunción"
                placeholderTextColor={colors.ink45}
                style={inputStyle}
              />
            </Field>

            {/* Price + currency */}
            <Field>
              <Label>{t('price')}</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.ink45}
                  style={[inputStyle, { flex: 1 }]}
                />
                <View style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
                  {['US$', '₲'].map((c) => {
                    const on = currency === c;
                    return (
                      <Pressable key={c} onPress={() => setCurrency(c)} style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: on ? colors.ink : 'transparent' }}>
                        <Text style={{ fontFamily: fonts.monoMed, fontSize: 14, color: on ? colors.paper : colors.ink }}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Field>

            {/* Area */}
            <Field>
              <Label>{EN ? 'Area (m²)' : 'Superficie (m²)'}</Label>
              <TextInput
                value={area}
                onChangeText={setArea}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.ink45}
                style={inputStyle}
              />
            </Field>

            {/* Contact name */}
            <Field>
              <Label>{EN ? 'Contact name' : 'Nombre de contacto'}</Label>
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder={EN ? 'Your name' : 'Tu nombre'}
                placeholderTextColor={colors.ink45}
                style={inputStyle}
              />
            </Field>

            {/* Phone */}
            <Field>
              <Label>{EN ? 'WhatsApp / phone' : 'WhatsApp / teléfono'}</Label>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="numeric"
                placeholder="0981 000 000"
                placeholderTextColor={colors.ink45}
                style={inputStyle}
              />
            </Field>

            {/* Description */}
            <Field>
              <Label>{t('description')}</Label>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={EN ? 'Describe the property…' : 'Describí la propiedad…'}
                placeholderTextColor={colors.ink45}
                style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
              />
            </Field>

            {/* Photos */}
            <Field>
              <Label>{EN ? 'Photos' : 'Fotos'}</Label>
              <View style={{ marginBottom: 10 }}>
                <Button
                  label={EN ? 'Add photos' : 'Agregar fotos'}
                  variant="outline"
                  small
                  icon={<Ionicons name="images-outline" size={18} color={colors.ink} />}
                  onPress={addPhotos}
                />
              </View>
              {photos.length > 0 ? (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={photos}
                  keyExtractor={(p, i) => `${p.uri}-${i}`}
                  renderItem={({ item, index }) => (
                    <View style={{ marginRight: 10 }}>
                      <Image source={{ uri: item.uri }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.hatch }} contentFit="cover" />
                      {index === 0 ? (
                        <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, color: colors.paper }}>1ª</Text>
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => removePhoto(index)}
                        hitSlop={8}
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="close" size={14} color={colors.paper} />
                      </Pressable>
                    </View>
                  )}
                />
              ) : null}
            </Field>

            {error ? (
              <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.danger, marginBottom: 12 }}>{error}</Text>
            ) : null}

            <Button
              label={EN ? 'Publish' : 'Publicar'}
              loading={submitting}
              onPress={submit}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
