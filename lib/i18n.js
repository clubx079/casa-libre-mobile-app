// Bilingual strings — Spanish default, English toggle (mirrors the web ES/EN).
// The WhatsApp contact message stays Spanish-only in both languages (brand rule).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

const STR = {
  es: {
    // nav / tabs
    buy: 'Comprar', rent: 'Alquilar', sell: 'Vender',
    search: 'Buscar', saved: 'Guardados', account: 'Cuenta', publish: 'Publicar',
    listForFree: 'Publicá gratis',
    all: 'Todas', home: 'Inicio', listings: 'Propiedades',
    // marketplace
    searchPlaceholder: 'Barrio, ciudad…',
    filters: 'Filtros', type: 'Tipo', price: 'Precio', beds: 'Dormitorios', sort: 'Orden',
    anyType: 'Cualquier tipo', anyPrice: 'Cualquier precio', anyBeds: 'Cualquiera',
    map: 'Mapa', list: 'Lista', results: 'resultados', noResults: 'Sin resultados',
    // map-first search
    loadingProps: 'Cargando propiedades…', searchingArea: 'Buscando en esta zona…', propsInArea: 'propiedades en esta zona', propInArea: 'propiedad en esta zona',
    zoomOut: 'Alejar mapa', clearFilters: 'Borrar filtros',
    loadError: 'No se pudieron cargar las propiedades', retry: 'Reintentar', seeAllInList: 'Ver todas en la lista', moreInArea: 'más en esta zona',
    clear: 'Limpiar', apply: 'Ver resultados', close: 'Cerrar',
    sortRelevance: 'Relevancia', sortPriceAsc: 'Precio: menor a mayor', sortPriceDesc: 'Precio: mayor a menor', sortAreaDesc: 'Superficie: mayor',
    // detail
    forSale: 'En venta', forRent: 'En alquiler', ref: 'Ref',
    description: 'Descripción', features: 'Características', location: 'Ubicación',
    bedsLabel: 'Dorm.', bathsLabel: 'Baños', m2Built: 'm² const.', landM2: 'Terreno m²', parking: 'Cocheras',
    // contact
    chatWhatsapp: 'Chatear por WhatsApp', call: 'Llamar', copyNumber: 'Copiar número', copied: 'Número copiado',
    publishedBy: 'Publicado por el propietario',
    reportUnresponsive: '¿No responde? Reportar', reportTitle: '¿El publicador no responde?',
    reportBody: 'Avisanos y revisaremos esta publicación. No compartas datos personales ni envíes dinero antes de visitar la propiedad.',
    reportSend: 'Reportar publicación', reportDone: 'Gracias, lo revisaremos.', cancel: 'Cancelar',
    reportReason: 'Motivo (opcional)', reportReasonPlaceholder: 'Contanos qué pasó…',
    antiScam: 'Nunca envíes dinero ni datos personales antes de visitar la propiedad y verificar al publicador.',
    share: 'Compartir', save: 'Guardar',
    // saved
    noFavorites: 'Todavía no guardaste ninguna propiedad.',
    // account / auth
    signIn: 'Iniciar sesión', signInGoogle: 'Ingresar con Google', signOut: 'Cerrar sesión',
    email: 'Correo', password: 'Contraseña', fullName: 'Nombre completo', phone: 'Teléfono',
    continue: 'Continuar', createAccount: 'Crear cuenta', verify: 'Verificar', code: 'Código',
    useAnotherEmail: 'Usar otro correo', resendCode: 'Reenviar código', backTo: 'Volver',
    profile: 'Perfil', myListings: 'Mis publicaciones', settings: 'Ajustes', comingSoon: 'Próximamente',
    signInToSave: 'Iniciá sesión para guardar y publicar', signInToPublish: 'Iniciá sesión para publicar gratis',
    // publish
    mode: 'Operación', neighborhood: 'Barrio', city: 'Ciudad', area: 'Superficie (m²)',
    contactName: 'Nombre de contacto', contactPhone: 'WhatsApp / Teléfono', currency: 'Moneda',
    addPhotos: 'Agregar fotos', photosHint: 'Subí al menos 1 foto (recomendado 4+).',
    publishTitle: 'Publicar propiedad', publishBtn: 'Publicar propiedad', done: '¡Listo!', publishedOk: 'Tu propiedad fue publicada.',
    viewMine: 'Ver mis publicaciones', publishAnother: 'Publicar otra',
    typeCasa: 'Casa', typeDepto: 'Departamento', typeDuplex: 'Dúplex', typeTerreno: 'Terreno',
    // empresas
    empresas: 'Para empresas', empresasTitle: 'Para inmobiliarias y desarrolladoras',
    // feedback
    feedback: 'Enviar comentarios', feedbackTitle: '¿Cómo fue tu experiencia?', feedbackSend: 'Enviar',
    thanks: '¡Gracias por tu comentario!',
    perMonth: '/mes', language: 'Idioma',
    // force-update gate (components/UpdateGate.js)
    updateRequiredTitle: 'Actualización necesaria',
    updateRequiredBody: 'Publicamos una nueva versión de Casa Libre. Para seguir usando la app, actualizá a la última versión.',
    updateNow: 'Actualizar ahora',
    updateAvailableTitle: 'Actualización disponible',
    updateAvailableBody: 'Hay una versión más nueva de Casa Libre con mejoras y correcciones.',
    updateLater: 'Más tarde',
    otaReadyTitle: 'Actualización lista',
    otaReadyBody: 'Descargamos una actualización. Reiniciá para aplicarla.',
    otaRestart: 'Reiniciar',
  },
  en: {
    buy: 'Buy', rent: 'Rent', sell: 'Sell',
    search: 'Search', saved: 'Saved', account: 'Account', publish: 'Publish',
    listForFree: 'List for free',
    all: 'All', home: 'Home', listings: 'Listings',
    searchPlaceholder: 'Neighborhood, city…',
    filters: 'Filters', type: 'Type', price: 'Price', beds: 'Bedrooms', sort: 'Sort',
    anyType: 'Any type', anyPrice: 'Any price', anyBeds: 'Any',
    map: 'Map', list: 'List', results: 'results', noResults: 'No results',
    // map-first search
    loadingProps: 'Loading properties…', searchingArea: 'Searching this area…', propsInArea: 'properties in this area', propInArea: 'property in this area',
    zoomOut: 'Zoom out', clearFilters: 'Clear filters',
    loadError: "Couldn't load properties", retry: 'Retry', seeAllInList: 'See all in the list', moreInArea: 'more in this area',
    clear: 'Clear', apply: 'Show results', close: 'Close',
    sortRelevance: 'Relevance', sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortAreaDesc: 'Area: largest',
    forSale: 'For sale', forRent: 'For rent', ref: 'Ref',
    description: 'Description', features: 'Features', location: 'Location',
    bedsLabel: 'Beds', bathsLabel: 'Baths', m2Built: 'm² built', landM2: 'Land m²', parking: 'Parking',
    chatWhatsapp: 'Chat on WhatsApp', call: 'Call', copyNumber: 'Copy number', copied: 'Number copied',
    publishedBy: 'Published by the owner',
    reportUnresponsive: 'Not responding? Report', reportTitle: 'Publisher not responding?',
    reportBody: "Let us know and we'll review this listing. Never share personal data or send money before visiting the property.",
    reportSend: 'Report listing', reportDone: "Thanks, we'll review it.", cancel: 'Cancel',
    reportReason: 'Reason (optional)', reportReasonPlaceholder: 'Tell us what happened…',
    antiScam: 'Never send money or personal data before visiting the property and verifying the publisher.',
    share: 'Share', save: 'Save',
    noFavorites: "You haven't saved any properties yet.",
    signIn: 'Sign in', signInGoogle: 'Sign in with Google', signOut: 'Sign out',
    email: 'Email', password: 'Password', fullName: 'Full name', phone: 'Phone',
    continue: 'Continue', createAccount: 'Create account', verify: 'Verify', code: 'Code',
    useAnotherEmail: 'Use another email', resendCode: 'Resend code', backTo: 'Back',
    profile: 'Profile', myListings: 'My listings', settings: 'Settings', comingSoon: 'Coming soon',
    signInToSave: 'Sign in to save and publish', signInToPublish: 'Sign in to list for free',
    mode: 'Operation', neighborhood: 'Neighborhood', city: 'City', area: 'Area (m²)',
    contactName: 'Contact name', contactPhone: 'WhatsApp / Phone', currency: 'Currency',
    addPhotos: 'Add photos', photosHint: 'Upload at least 1 photo (4+ recommended).',
    publishTitle: 'Publish property', publishBtn: 'Publish property', done: 'Done!', publishedOk: 'Your property has been published.',
    viewMine: 'View my listings', publishAnother: 'Publish another',
    typeCasa: 'House', typeDepto: 'Apartment', typeDuplex: 'Duplex', typeTerreno: 'Land',
    empresas: 'For businesses', empresasTitle: 'For agencies & developers',
    feedback: 'Send feedback', feedbackTitle: 'How was your experience?', feedbackSend: 'Send',
    thanks: 'Thanks for your feedback!',
    perMonth: '/mo', language: 'Language',
    // force-update gate (components/UpdateGate.js)
    updateRequiredTitle: 'Update required',
    updateRequiredBody: "We've released a new version of Casa Libre. To keep using the app, please update to the latest version.",
    updateNow: 'Update now',
    updateAvailableTitle: 'Update available',
    updateAvailableBody: 'A newer version of Casa Libre is available with improvements and fixes.',
    updateLater: 'Later',
    otaReadyTitle: 'Update ready',
    otaReadyBody: 'We downloaded an update. Restart to apply it.',
    otaRestart: 'Restart',
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
