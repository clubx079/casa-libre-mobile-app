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
import { useAuth, auth } from '../../lib/session';
import { getApiBase } from '../../lib/config';
import { useCountry } from '../../lib/country';
import Button from '../../components/Button';
import NeighborhoodAutocomplete from '../../components/NeighborhoodAutocomplete';

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
// Selectable plan card (radio) — mirrors the website's plan boxes: title + price +
// one-line benefit, a filled radio when chosen, optional "Recommended" badge.
function PlanCard({ on, onPress, title, price, sub, recommended }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: on ? colors.ink : colors.ink12, backgroundColor: on ? colors.card : colors.paper, borderRadius: 14, padding: 13, marginBottom: 10 }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.ink : colors.ink30, alignItems: 'center', justifyContent: 'center' }}>
        {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ink }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink }}>{title}</Text>
          {recommended ? (
            <View style={{ backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.paper, textTransform: 'uppercase', letterSpacing: 0.5 }}>{recommended}</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink60, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {price ? <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink70 }}>{price}</Text> : null}
    </Pressable>
  );
}

export default function Publish() {
  const { t, lang } = useI18n();
  const es = lang !== 'en';
  const { user, loading } = useAuth();
  const { country } = useCountry();

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
  const [coords, setCoords] = useState(null); // { latitude, longitude } from the address pick
  const [formKey, setFormKey] = useState(0);  // bump to remount the autocomplete on reset
  const [plan, setPlan] = useState('free'); // 'free' | 'verified' | 'home' — paid plans finish on the website
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
            <Button label={t('publishAnother')} variant="outline" onPress={resetForm} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function resetForm() {
    setMode('venta'); setPtype('casa'); setNeighborhood(''); setCity('Asunción'); setPrice('');
    setCurrency('US$'); setArea(''); setContactName(user?.full_name || ''); setContactPhone('');
    setDescription(''); setPhotos([]); setCoords(null); setPlan('free'); setError(''); setDone(null); setFormKey((k) => k + 1);
  }
  // Map picker result → fill neighborhood + city + precise coordinates.
  function onPickLocation({ neighborhood: nh, city: cy, latitude, longitude }) {
    if (nh) setNeighborhood(nh);
    if (cy) setCity(cy);
    if (latitude != null && longitude != null) setCoords({ latitude, longitude });
    setError('');
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
    if (!contactName.trim()) return es ? 'Ingresá tu nombre' : 'Enter your name';
    if (digits.length < 6) return t('contactPhone');
    if (photos.length < 1) return es ? 'Agregá al menos 1 foto' : 'Add at least 1 photo';
    return '';
  }
  // Open the web Stripe payment for a specific listing + plan, already signed in via
  // a one-shot handoff (the browser doesn't share the app's login). The web page
  // auto-opens the Stripe modal from ?pay=<id>&plan=<plan>.
  async function openStripe(id, pl) {
    const next = id ? `/cuenta/publicaciones?pay=${id}&plan=${pl}` : '/cuenta/publicaciones';
    const fallback = `${getApiBase()}${next}`;
    try {
      const { ok, data } = await auth.handoff(next);
      await WebBrowser.openBrowserAsync(ok && data?.url ? data.url : fallback);
    } catch {
      try { await WebBrowser.openBrowserAsync(fallback); } catch { Linking.openURL(fallback).catch(() => {}); }
    }
  }

  async function submit() {
    // ALWAYS publish (free) first so the listing is saved + live immediately — no
    // data is lost. If a paid plan was chosen, we then hand off to the website
    // (signed in) to pay for the Verified / Home-page upgrade (in-app sale of these
    // is forbidden by Apple/Google). Promotion is applied on the web after payment.
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
      if (coords) { fd.append('latitude', String(coords.latitude)); fd.append('longitude', String(coords.longitude)); }
      fd.append('description', description.trim());
      fd.append('contact_name', contactName.trim());
      fd.append('contact_phone', (contactPhone || '').replace(/\D/g, ''));
      // Expo SDK 57 / RN 0.86 uses the spec FormData, which rejects the classic
      // { uri, name, type } file part ("Unsupported FormDataPart implementation").
      // Append a real Blob read from each photo's uri instead.
      for (let i = 0; i < photos.length; i++) {
        try {
          const rb = await fetch(photos[i].uri);
          const blob = await rb.blob();
          fd.append('photos', blob, `photo${i}.jpg`);
        } catch { /* skip a photo that can't be read */ }
      }
      const res = await fetch(`${getApiBase()}/api/publish`, { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.ref || data.ok)) {
        if (plan !== 'free') {
          // Published free; go STRAIGHT to the Stripe payment on the web for this
          // listing + the plan already chosen — no in-app success screen.
          await openStripe(data.id, plan);
          resetForm();
        } else {
          setDone({ ref: data.ref || 'CL-…' });
        }
      } else {
        setError((data && data.error) || (es ? 'No se pudo publicar. Intentá de nuevo.' : 'Could not publish. Try again.'));
      }
    } catch {
      setError(es ? 'Error de red. Intentá de nuevo.' : 'Network error. Try again.');
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
            <NeighborhoodAutocomplete
              key={formKey}
              value={neighborhood}
              placeholder="Villa Morra, Recoleta…"
              origin={country?.origin}
              countryCode={country?.code}
              lang={lang}
              onChangeText={setNeighborhood}
              onPick={onPickLocation}
            />
            {coords ? (
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink45, marginTop: 6 }}>
                📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
            ) : null}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4, paddingRight: 4 }}>
                {photos.map((item, index) => (
                  <View key={`${item.uri}-${index}`} style={{ marginRight: 10 }}>
                    <Image source={{ uri: item.uri }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.hatch }} contentFit="cover" />
                    {index === 0 ? (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 }}>
                        <Ionicons name="star" size={11} color={colors.paper} />
                      </View>
                    ) : null}
                    <Pressable onPress={() => removePhoto(index)} hitSlop={8} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.paper }}>
                      <Ionicons name="close" size={14} color={colors.paper} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Field>

          <Field>
            <Label>{es ? 'Visibilidad (opcional)' : 'Visibility (optional)'}</Label>
            <PlanCard
              on={plan === 'verified'} onPress={() => setPlan((p) => (p === 'verified' ? 'free' : 'verified'))}
              title={es ? 'Verificada' : 'Verified'} price={es ? '30 días' : '30 days'}
              sub={es ? 'Insignia Verificada en el marketplace' : 'Verified badge on the marketplace'}
            />
            <PlanCard
              on={plan === 'home'} onPress={() => setPlan((p) => (p === 'home' ? 'free' : 'home'))}
              title={es ? 'En la portada' : 'On the home page'} price={es ? '30 días' : '30 days'}
              sub={es ? 'Portada + insignia Verificada' : 'Home page + Verified badge'}
              recommended={es ? 'Recomendado' : 'Recommended'}
            />
          </Field>

          {error ? <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

          <Button label={t('publishBtn')} loading={submitting} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}
