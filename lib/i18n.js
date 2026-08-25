// Bilingual strings — Spanish default, English toggle (mirrors the web ES/EN).
// The WhatsApp contact message stays Spanish-only in both languages (per brand rule).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

const STR = {
  es: {
    buy: 'Comprar', rent: 'Alquilar', sell: 'Vender',
    search: 'Buscar', saved: 'Guardados', account: 'Cuenta', publish: 'Publicar',
    listForFree: 'Publicá gratis',
    forSale: 'En venta', forRent: 'En alquiler',
    filters: 'Filtros', type: 'Tipo', price: 'Precio', beds: 'Dormitorios', clear: 'Limpiar', apply: 'Aplicar',
    all: 'Todos', anyPrice: 'Cualquier precio', map: 'Mapa', list: 'Lista',
    results: 'resultados', noResults: 'Sin resultados',
    chatWhatsapp: 'Chatear por WhatsApp', call: 'Llamar', copyNumber: 'Copiar número', copied: 'Copiado',
    publishedBy: 'Publicado por el propietario', reportUnresponsive: '¿No responde? Reportar',
    share: 'Compartir', save: 'Guardar', saved2: 'Guardado',
    description: 'Descripción', features: 'Características', location: 'Ubicación',
    m2Built: 'm² const.', parking: 'cocheras',
    noFavorites: 'Todavía no guardaste ninguna propiedad.',
    signIn: 'Iniciar sesión', signOut: 'Cerrar sesión', email: 'Correo', password: 'Contraseña',
    empresas: 'Para empresas', feedback: 'Enviar comentarios',
    ref: 'Ref', home: 'Inicio', listings: 'Propiedades',
  },
  en: {
    buy: 'Buy', rent: 'Rent', sell: 'Sell',
    search: 'Search', saved: 'Saved', account: 'Account', publish: 'Publish',
    listForFree: 'List for free',
    forSale: 'For sale', forRent: 'For rent',
    filters: 'Filters', type: 'Type', price: 'Price', beds: 'Bedrooms', clear: 'Clear', apply: 'Apply',
    all: 'All', anyPrice: 'Any price', map: 'Map', list: 'List',
    results: 'results', noResults: 'No results',
    chatWhatsapp: 'Chat on WhatsApp', call: 'Call', copyNumber: 'Copy number', copied: 'Copied',
    publishedBy: 'Published by the owner', reportUnresponsive: 'Not responding? Report',
    share: 'Share', save: 'Save', saved2: 'Saved',
    description: 'Description', features: 'Features', location: 'Location',
    m2Built: 'm² built', parking: 'parking',
    noFavorites: "You haven't saved any properties yet.",
    signIn: 'Sign in', signOut: 'Sign out', email: 'Email', password: 'Password',
    empresas: 'For businesses', feedback: 'Send feedback',
    ref: 'Ref', home: 'Home', listings: 'Listings',
  },
};

const KEY = 'cl.lang.v1';
const I18nContext = createContext({ lang: 'es', t: (k) => STR.es[k] || k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('es');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'en' || v === 'es') setLangState(v); }).catch(() => {});
  }, []);
  const setLang = (l) => { setLangState(l); AsyncStorage.setItem(KEY, l).catch(() => {}); };
  const t = (k) => (STR[lang] && STR[lang][k]) || STR.es[k] || k;
  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
