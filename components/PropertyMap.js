// Map of listings using GOOGLE MAPS (JS API) inside a WebView — same basemap
// style, brand pills and clustering as the website (utils/gmap.js). Rendering in
// a WebView (not native react-native-maps) keeps it working in Expo Go AND lets
// us reuse the site's referrer-restricted Maps key: the WebView's baseUrl is
// casa-libre.com.py, so Google accepts the key. Price-pill markers; tapping one
// posts the listing id back to RN. Google's logo/attribution are hidden with CSS
// to match the site's clean brand look.
import { useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { colors, fonts } from '../lib/theme';
import { shortUsd } from '../lib/format';
import { getMapCenter } from '../lib/config';
import { getCountry } from '../lib/country';

// Google-Maps-style navigation triangle, tilted 45° — pixel-faithful to the
// website's CURRENT "my location" control (components/MobileMarketplace.js):
// 19px glyph, path M12 2 4.5 20.3…, rotate(45deg), Google-gray #3c4043 fill on a
// white circle with a soft 0 1px 4px rgba(0,0,0,.3) shadow.
const LOCATE_INK = '#3c4043';
function NavTriangle({ size = 19, color = LOCATE_INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ transform: [{ rotate: '45deg' }] }}>
      <Path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" />
    </Svg>
  );
}

// Soft drop shadow matching the website's shadow-[0_1px_4px_rgba(0,0,0,0.3)] —
// deliberately NOT the brand hard-offset shadow; the site's locate control is a
// standard Google-style floating button.
const locateShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
};

// Public (client) Maps JS key — same one the website uses; referrer-restricted to
// casa-libre.com.py, which the WebView baseUrl below satisfies.
const MAPS_KEY = 'AIzaSyBRMxUxsq4taEGbcelOv-IvlJk6R36IbLA';

// Casa Libre basemap — copied verbatim from the website (utils/gmap.js CL_MAP_STYLE).
const CL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#E6DDCD' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4b4942' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F3ECDF' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D5DFBE' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D8CFBB' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FBF7EF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F4EEE0' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#CFC4AC' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C4D3CC' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7d8d86' }] },
];

function buildHtml(points, center, zoom, single, fitBounds) {
  const data = JSON.stringify(points);
  const style = JSON.stringify(CL_MAP_STYLE);
  const fit = fitBounds ? 'true' : 'false';
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#E6DDCD;overflow:hidden;}
  /* Hide Google's on-map branding/attribution to match the website's clean look. */
  .gm-style-cc, .gmnoprint, .gm-bundled-control,
  a[href^="https://maps.google"], a[href^="http://maps.google"],
  .gm-style a[title*="Google"], .gm-style img[alt="Google"] { display:none !important; }
  .gm-style-cc { display:none !important; }
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js"></script>
<script>
  var pts = ${data};
  var single = ${single ? 'true' : 'false'};
  var CL_STYLE = ${style};
  var CREAM = '#F9F4EE', INK = '#111111';
  function uri(svg){ return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg); }
  // A PROMOTED pin (paid verified/home listing) is larger and carries a paper star
  // before the price — matching the website — and the client keeps it out of clusters.
  function pinSvg(label, promoted){
    var t = String(label == null ? '•' : label);
    if (promoted) {
      var h = 30, fs = 13, lpad = 31, coinCx = 16, coinCy = h/2, coinR = 9.5, s = 0.6, sc = 12*s;
      var w = Math.max(62, Math.round(18 + lpad + t.length * 8.2));
      return "<svg xmlns='http://www.w3.org/2000/svg' width='"+w+"' height='"+h+"'>"
        + "<rect x='0' y='0' width='"+w+"' height='"+h+"' rx='"+(h/2)+"' fill='"+INK+"'/>"
        + "<rect x='2' y='2' width='"+(w-4)+"' height='"+(h-4)+"' rx='"+((h-4)/2)+"' fill='"+INK+"' stroke='"+CREAM+"' stroke-width='2.5'/>"
        + "<circle cx='"+coinCx+"' cy='"+coinCy+"' r='"+coinR+"' fill='"+CREAM+"'/>"
        + "<path transform='translate("+(coinCx-sc)+" "+(coinCy-sc)+") scale("+s+")' fill='"+INK+"' d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/>"
        + "<text x='"+(lpad + (w-lpad)/2)+"' y='"+(h/2+1)+"' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='"+fs+"' font-weight='700' fill='"+CREAM+"'>"+t+"</text></svg>";
    }
    var w = Math.max(28, Math.round(16 + t.length * 7.6)), h = 24;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='"+w+"' height='"+h+"'>"
      + "<rect x='1.5' y='1.5' width='"+(w-3)+"' height='"+(h-3)+"' rx='"+((h-3)/2)+"' fill='"+INK+"' stroke='"+CREAM+"' stroke-width='2'/>"
      + "<text x='"+(w/2)+"' y='"+(h/2+1)+"' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='12' font-weight='700' fill='"+CREAM+"'>"+t+"</text></svg>";
  }
  function pillIcon(p){
    var promoted = !!p.promoted;
    var t = String(p.label||'•');
    var h, w;
    if (promoted) { h = 30; w = Math.max(62, Math.round(18 + 31 + t.length * 8.2)); }
    else { h = 24; w = Math.max(28, Math.round(16 + t.length * 7.6)); }
    return { url: uri(pinSvg(p.label, promoted)), scaledSize: new google.maps.Size(w,h), anchor: new google.maps.Point(w/2, h/2) };
  }
  function dotSvg(){
    return "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='6' fill='"+INK+"' stroke='"+CREAM+"' stroke-width='3'/></svg>";
  }
  // "You are here" marker — a Google-style blue location dot with a white ring.
  function youSvg(){
    return "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'>"
      + "<circle cx='11' cy='11' r='10' fill='#1a73e8' opacity='0.18'/>"
      + "<circle cx='11' cy='11' r='6' fill='#1a73e8' stroke='#ffffff' stroke-width='2.5'/></svg>";
  }
  function clusterSvg(n){
    var s = 40;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='"+s+"' height='"+s+"'>"
      + "<circle cx='"+(s/2)+"' cy='"+(s/2)+"' r='"+(s/2-2)+"' fill='"+INK+"' stroke='"+CREAM+"' stroke-width='2'/>"
      + "<text x='"+(s/2)+"' y='"+(s/2+1)+"' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' font-weight='700' fill='"+CREAM+"'>"+n+"</text></svg>";
  }
  function initMap(){
    var map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: ${center.lat}, lng: ${center.lng} }, zoom: ${zoom},
      styles: CL_STYLE, disableDefaultUI: true, clickableIcons: false, keyboardShortcuts: false, gestureHandling: 'greedy',
      // Fractional zoom keeps the double-tap-drag gesture (below) buttery instead
      // of snapping between integer levels (raster maps default this to false).
      isFractionalZoomEnabled: true,
    });
    var bounds = new google.maps.LatLngBounds();
    var clusterMarkers = [];
    var markers = pts.map(function(p){
      var icon = single
        ? { url: uri(dotSvg()), scaledSize: new google.maps.Size(16,16), anchor: new google.maps.Point(8,8) }
        : pillIcon(p);
      var m = new google.maps.Marker({ position:{ lat:p.lat, lng:p.lng }, icon: icon, zIndex: (!single && p.promoted) ? 10000 : undefined });
      m.addListener('click', function(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(p.id); } });
      bounds.extend({ lat:p.lat, lng:p.lng });
      // A paid listing is never swallowed by a cluster — put it straight on the map.
      if (!single && p.promoted) { m.setMap(map); } else { clusterMarkers.push(m); }
      return m;
    });
    if (single) {
      markers.forEach(function(m){ m.setMap(map); });
    } else if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
      new markerClusterer.MarkerClusterer({
        map: map, markers: clusterMarkers,
        algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 90, maxZoom: 16 }),
        renderer: { render: function(o){ return new google.maps.Marker({ position:o.position, zIndex:1000+o.count, icon:{ url: uri(clusterSvg(o.count)), scaledSize: new google.maps.Size(40,40), anchor: new google.maps.Point(20,20) } }); } },
      });
    } else {
      clusterMarkers.forEach(function(m){ m.setMap(map); });
    }
    if (${fit} && pts.length > 1) { try { map.fitBounds(bounds, 40); } catch(e){} }
    window.__clMap = map;
    setupDblTapZoom(map);
  }
  // "Double-tap, hold, and drag to zoom" — the native Google Maps one-finger
  // gesture. The Maps JS API does NOT ship it (only two-finger pinch + a discrete
  // double-tap-to-zoom), so we implement it explicitly and ONLY act once a genuine
  // double-tap-hold is detected. Single-finger pan and two-finger pinch are left
  // untouched (we bail whenever touches.length !== 1).
  //
  // SMOOTHNESS: during the drag we DON'T call map.setZoom every frame — each
  // setZoom reloads map tiles, which lags behind the finger. Instead we apply a
  // GPU-accelerated CSS transform:scale() to the map div, anchored at the
  // double-tap point (transform-origin) — this tracks the finger instantly with
  // zero tile work (same trick Google Maps uses: scaled/blurry tiles while
  // gesturing, sharp on release). We commit the real zoom exactly ONCE on
  // touchend (Δzoom = log2(scaleFactor)) and recenter so the anchor point stays
  // put, then drop the transform so tiles reload a single time at the final zoom.
  function setupDblTapZoom(map){
    var el = document.getElementById('map');
    if (!el) return;
    // ~175px of drag == one zoom level (a comfortable ~150-200px = 1x).
    var TAP_GAP = 300, TAP_DIST = 40, PX_PER_ZOOM = 175, MINZ = 3, MAXZ = 20;
    var lastTapTime = 0, lastTapX = 0, lastTapY = 0;
    var active = false, originX = 0, originY = 0, startZoom = 0, targetScale = 1, raf = null;
    function paint(){ raf = null; if (active) el.style.transform = 'scale(' + targetScale + ')'; }
    function clearTransform(){ el.style.transform = ''; el.style.transformOrigin = ''; el.style.willChange = 'auto'; }
    function commit(){
      var dz = Math.log(targetScale) / Math.LN2;                 // log2(scaleFactor)
      var newZoom = Math.max(MINZ, Math.min(MAXZ, startZoom + dz));
      try {
        var proj = map.getProjection();
        if (proj) {
          // Anchor the double-tap point: convert it to a world coord at the old
          // zoom, then pick the new center that keeps it under the same pixel.
          var rect = el.getBoundingClientRect();
          var px = originX - rect.left, py = originY - rect.top;
          var cx = rect.width / 2, cy = rect.height / 2;
          var s0 = 256 * Math.pow(2, startZoom), s1 = 256 * Math.pow(2, newZoom);
          var wc = proj.fromLatLngToPoint(map.getCenter());
          var ax = wc.x + (px - cx) / s0, ay = wc.y + (py - cy) / s0;
          var nc = new google.maps.Point(ax - (px - cx) / s1, ay - (py - cy) / s1);
          map.setZoom(newZoom);
          map.setCenter(proj.fromPointToLatLng(nc));
        } else {
          map.setZoom(newZoom);                                  // fallback: zoom about center
        }
      } catch(err) { try { map.setZoom(newZoom); } catch(e2){} }
      clearTransform();                                          // tiles reload ONCE, at final zoom
    }
    el.addEventListener('touchstart', function(e){
      if (e.touches.length !== 1) { if (active) { active = false; clearTransform(); } return; } // 2 fingers => pinch
      var t = e.touches[0], now = Date.now();
      var dx = t.clientX - lastTapX, dy = t.clientY - lastTapY;
      var near = (dx*dx + dy*dy) < TAP_DIST*TAP_DIST;
      if (now - lastTapTime < TAP_GAP && near) {
        // Second tap of a double-tap and the finger is still down: begin zoom.
        active = true; originX = t.clientX; originY = t.clientY; targetScale = 1;
        startZoom = (typeof map.getZoom() === 'number') ? map.getZoom() : ${zoom};
        el.style.transformOrigin = originX + 'px ' + originY + 'px';
        el.style.willChange = 'transform';
        e.preventDefault(); e.stopPropagation();      // suppress Google's own dbl-tap zoom
      } else {
        active = false;
      }
      lastTapTime = now; lastTapX = t.clientX; lastTapY = t.clientY;
    }, { passive: false, capture: true });
    el.addEventListener('touchmove', function(e){
      if (!active || e.touches.length !== 1) return;
      e.preventDefault(); e.stopPropagation();          // don't let the map pan
      var f = Math.pow(2, (originY - e.touches[0].clientY) / PX_PER_ZOOM); // drag UP = zoom in
      // Clamp the visual scale so the committed zoom can't exceed the map limits.
      var fMin = Math.pow(2, MINZ - startZoom), fMax = Math.pow(2, MAXZ - startZoom);
      targetScale = f < fMin ? fMin : (f > fMax ? fMax : f);
      if (raf == null) raf = requestAnimationFrame(paint); // one style write per frame
    }, { passive: false, capture: true });
    el.addEventListener('touchend', function(){ if (active) { active = false; commit(); } }, { capture: true });
    el.addEventListener('touchcancel', function(){ if (active) { active = false; clearTransform(); } }, { capture: true });
  }
  // Recenter on the user's location and drop/update a "you are here" marker.
  // Called from React Native via WebView.injectJavaScript().
  window.__clFlyTo = function(lat, lng){
    var map = window.__clMap; if (!map) return;
    var p = { lat: lat, lng: lng };
    try { map.panTo(p); map.setZoom(14); } catch(e){}
    if (window.__clYou) { try { window.__clYou.setMap(null); } catch(e){} }
    window.__clYou = new google.maps.Marker({
      position: p, map: map, zIndex: 99999,
      icon: { url: uri(youSvg()), scaledSize: new google.maps.Size(22,22), anchor: new google.maps.Point(11,11) },
    });
  };
  window.initMap = initMap;
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap&loading=async"></script>
</body></html>`;
}

export default function PropertyMap({ listings = [], style, single = null, isFiltered = false, onMarkerPress, userLocation = null, onLocatePress, locating = false }) {
  const pts = single ? (single.lat && single.lng ? [single] : []) : listings.filter((l) => l.lat && l.lng);
  const webRef = useRef(null);
  // Show the "locate me" control on the browse map only (not the single-property mini-map).
  const showLocate = !single && typeof onLocatePress === 'function';

  const country = getCountry();
  const html = useMemo(() => {
    const points = pts.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: shortUsd(l.usd), promoted: !!(l.verified || l.plan) }));
    const mc = getMapCenter();
    const center = single && single.lat ? { lat: single.lat, lng: single.lng } : { lat: mc.latitude, lng: mc.longitude };
    const zoom = single ? country.singleZoom : country.mapZoom;
    const fitBounds = !single && isFiltered;
    return buildHtml(points, center, zoom, !!single, fitBounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.length, single?.id, isFiltered, country.code]);

  const flyTo = (loc) => {
    if (!loc || !webRef.current) return;
    const lat = Number(loc.latitude), lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    webRef.current.injectJavaScript(`window.__clFlyTo && window.__clFlyTo(${lat}, ${lng}); true;`);
  };

  // Recenter whenever the shared user location changes (e.g. "Near me" from the list).
  useEffect(() => { if (showLocate && userLocation) flyTo(userLocation); }, [userLocation?.latitude, userLocation?.longitude]);

  const handleLocate = async () => {
    const loc = (await onLocatePress?.()) || userLocation;
    if (loc) flyTo(loc);
  };

  if (!pts.length) {
    return (
      <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center', padding: 20 }, style]}>
        <Text style={{ fontFamily: fonts.mono, color: colors.ink60, fontSize: 12 }}>Sin ubicación</Text>
      </View>
    );
  }

  const onMessage = (e) => {
    const id = e?.nativeEvent?.data;
    if (!id) return;
    if (onMarkerPress) onMarkerPress(id);
    else router.push(`/property/${id}`);
  };

  return (
    <View style={style}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: country.origin }}
        style={{ flex: 1, backgroundColor: colors.hatch }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
      {showLocate ? (
        <Pressable
          onPress={handleLocate}
          accessibilityLabel="My location"
          hitSlop={8}
          style={({ pressed }) => [{
            position: 'absolute', right: 16, bottom: 92,
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            ...locateShadow,
          }, pressed && { transform: [{ translateY: 1 }] }]}
        >
          {locating ? <ActivityIndicator size="small" color={LOCATE_INK} /> : <NavTriangle size={19} color={LOCATE_INK} />}
        </Pressable>
      ) : null}
    </View>
  );
}
