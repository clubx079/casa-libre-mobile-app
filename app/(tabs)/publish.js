// Publish (list a property) tab — login-gated single-page form mirroring the web
// /publicar flow. Native only (multipart upload with the httpOnly cl_session cookie).
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import MascotLoader from '../../components/MascotLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radii } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/session';
import { getApiBase } from '../../lib/config';
import Button from '../../components/Button';

// ── Module-scope UI helpers (defining these inside the component would remount
// every TextInput on each keystroke — that's the "keyboard closes after 1 word" bug).
const inputStyle = {
  borderWidth: 1.5, borderColor: colors.ink12, borderRadius: 14, padding: 12,
  fontFamily: fonts.sans, fontSize: 15, color: colors.ink, backgroundColor: colors.card,
};
function Label({ children }) {
  return <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: colors.ink60, marginBottom: 6, textTransform: 'uppercase' }}>{children}</Text>;
}
function Field({ children }) {
  return <View style={{ marginBottom: 16 }}>{children}</View>;
}
function Chip({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: active ? colors.ink : colors.ink30, backgroundColor: active ? colors.ink : colors.card, marginRight: 8, marginBottom: 8 }}>
      <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: active ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
// Square checkbox row (no prices shown — paid options only steer the publish route).
function CheckRow({ checked, label, onToggle }) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: checked ? colors.ink : colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.paper} /> : null}
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export default function Publish() {
  const { t } = useI18n();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState('venta');
  const [ptype, setPtype] = useState('casa');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Asunción');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('US$'); // US$ | Gs
  const [area, setArea] = useState('');
  const [contactName, setContactName] = useState(user?.full_name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [wantVerified, setWantVerified] = useState(false); // paid: Verified on marketplace
  const [wantHome, setWantHome] = useState(false);         // paid: Display on home page
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const MODES = [{ k: 'venta', label: t('buy') }, { k: 'alquiler', label: t('rent') }];
  const TYPES = [
    { k: 'casa', label: t('typeCasa') }, { k: 'departamento', label: t('typeDepto') },
    { k: 'duplex', label: t('typeDuplex') }, { k: 'terreno', label: t('typeTerreno') },
  ];

  if (loading) {
    return <MascotLoader />;
  }
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
          <Ionicons name="home-outline" size={44} color={colors.ink30} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink, textAlign: 'center' }}>{t('signInToPublish')}</Text>
          <View style={{ alignSelf: 'stretch' }}><Button label={t('signIn')} onPress={() => router.push('/auth')} /></View>
        </View>
      </SafeAreaView>
    );
  }
  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Ionicons name="checkmark-circle-outline" size={52} color={colors.success} />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink }}>{t('done')}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink70, textAlign: 'center' }}>{t('publishedOk')}</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink60 }}>{t('ref')}: {done.ref}</Text>
          <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
            <Button label={t('viewMine')} onPress={() => Alert.alert(t('comingSoon'))} />
            <Button label={t('publishAnother')} variant="outline" onPress={resetForm} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function resetForm() {
    setMode('venta'); setPtype('casa'); setNeighborhood(''); setCity('Asunción'); setPrice('');
    setCurrency('US$'); setArea(''); setContactName(user?.full_name || ''); setContactPhone('');
    setDescription(''); setPhotos([]); setWantVerified(false); setWantHome(false); setError(''); setDone(null);
  }
  async function addPhotos() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 20 });
      if (res.canceled) return;
      setPhotos((prev) => [...prev, ...(res.assets || []).map((a) => ({ uri: a.uri }))].slice(0, 20));
    } catch {}
  }
  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  function validate() {
    const digits = (contactPhone || '').replace(/\D/g, '');
    const priceNum = Number((price || '').replace(/[^\d.]/g, ''));
    const areaNum = Number((area || '').replace(/[^\d.]/g, ''));
    if (!neighborhood.trim()) return t('neighborhood');
    if (!city.trim()) return t('city');
    if (!priceNum) return t('price');
    if (mode === 'venta' && currency === 'US$' && priceNum < 5000) return 'Mín. US$ 5.000';
    if (mode === 'alquiler' && currency === 'Gs' && priceNum < 300000) return 'Mín. Gs 300.000/mes';
    if (ptype !== 'terreno' && (!areaNum || areaNum < 5 || areaNum > 2000)) return '5 – 2000 m²';
    if (digits.length < 6) return t('contactPhone');
    if (photos.length < 1) return t('addPhotos');
    return '';
  }
  async function submit() {
    // Paid visibility (Verified / Home page) is sold + charged on the website only.
    // If either box is checked, don't publish from the app — send the user to the
    // web publish page to complete payment there. No payment logic lives in the app.
    if (wantVerified || wantHome) {
      const url = `${getApiBase()}/publicar`;
      try { await WebBrowser.openBrowserAsync(url); }
      catch { Linking.openURL(url).catch(() => {}); }
      return;
    }
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError(''); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('mode', mode);
      fd.append('ptype', ptype);
      fd.append('neighborhood', neighborhood.trim());
      fd.append('city', city.trim());
      fd.append('price', String(Number((price || '').replace(/[^\d.]/g, ''))));
      fd.append('currency', currency === 'Gs' ? 'PYG' : 'USD');
      fd.append('area', String(Number((area || '').replace(/[^\d.]/g, '')) || 0));
      fd.append('description', description.trim());
      fd.append('contact_name', contactName.trim());
      fd.append('contact_phone', (contactPhone || '').replace(/\D/g, ''));
      photos.forEach((a, i) => fd.append('photos', { uri: a.uri, name: `photo${i}.jpg`, type: 'image/jpeg' }));
      const res = await fetch(`${getApiBase()}/api/publish`, { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.ref || data.ok)) setDone({ ref: data.ref || 'CL-…' });
      else setError((data && data.error) || 'No se pudo publicar. Intentá de nuevo.');
    } catch {
      setError('Error de red. Intentá de nuevo.');
    } finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink, marginBottom: 20 }}>{t('publishTitle')}</Text>

          <Field>
            <Label>{t('mode')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {MODES.map((m) => <Chip key={m.k} active={mode === m.k} label={m.label} onPress={() => setMode(m.k)} />)}
            </View>
          </Field>

          <Field>
            <Label>{t('type')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TYPES.map((ty) => <Chip key={ty.k} active={ptype === ty.k} label={ty.label} onPress={() => setPtype(ty.k)} />)}
            </View>
          </Field>

          <Field>
            <Label>{t('neighborhood')}</Label>
            <TextInput value={neighborhood} onChangeText={setNeighborhood} placeholder="Villa Morra" placeholderTextColor={colors.ink45} style={inputStyle} />
          </Field>

          <Field>
            <Label>{t('city')}</Label>
            <TextInput value={city} onChangeText={setCity} placeholder="Asunción" placeholderTextColor={colors.ink45} style={inputStyle} />
          </Field>

          <Field>
            <Label>{t('price')}</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.ink45} style={[inputStyle, { flex: 1 }]} />
              <View style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: radii.pill, overflow: 'hidden' }}>
                {['US$', 'Gs'].map((c) => {
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

          <Field>
            <Label>{t('area')}</Label>
            <TextInput value={area} onChangeText={setArea} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.ink45} style={inputStyle} />
          </Field>

          <Field>
            <Label>{t('contactName')}</Label>
            <TextInput value={contactName} onChangeText={setContactName} placeholderTextColor={colors.ink45} style={inputStyle} />
          </Field>

          <Field>
            <Label>{t('contactPhone')}</Label>
            <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" placeholder="0981 000 000" placeholderTextColor={colors.ink45} style={inputStyle} />
          </Field>

          <Field>
            <Label>{t('description')}</Label>
            <TextInput value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.ink45} style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} />
          </Field>

          <Field>
            <Label>{t('addPhotos')}</Label>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink45, marginBottom: 10 }}>{t('photosHint')}</Text>
            <View style={{ marginBottom: 10 }}>
              <Button label={t('addPhotos')} variant="outline" icon={<Ionicons name="images-outline" size={18} color={colors.ink} />} onPress={addPhotos} style={{ alignSelf: 'stretch', backgroundColor: colors.card }} />
            </View>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {photos.map((item, index) => (
                  <View key={`${item.uri}-${index}`} style={{ marginRight: 10 }}>
                    <Image source={{ uri: item.uri }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.hatch }} contentFit="cover" />
                    {index === 0 ? (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 }}>
                        <Ionicons name="star" size={11} color={colors.paper} />
                      </View>
                    ) : null}
                    <Pressable onPress={() => removePhoto(index)} hitSlop={8} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={14} color={colors.paper} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Field>

          <Field>
            <Label>{t('addVisibility')}</Label>
            <View style={{ borderWidth: 1.5, borderColor: colors.ink12, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 4 }}>
              <CheckRow checked={wantVerified} label={t('optVerified')} onToggle={() => setWantVerified((v) => !v)} />
              <View style={{ height: 1, backgroundColor: colors.ink12 }} />
              <CheckRow checked={wantHome} label={t('optHome')} onToggle={() => setWantHome((v) => !v)} />
            </View>
            {(wantVerified || wantHome) ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink45, marginTop: 8 }}>{t('paidHint')}</Text>
            ) : null}
          </Field>

          {error ? <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

          <Button label={t('publishBtn')} loading={submitting} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
