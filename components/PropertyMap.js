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
<script src="https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.5.3/dist/index.min.js"></script>
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
      var m = new google.maps.Marker({ position:{ lat:p.lat, lng:p.lng }, icon: icon, optimized: false, zIndex: (!single && p.promoted) ? 10000 : undefined });
      m.addListener('click', function(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(p.id); } });
      bounds.extend({ lat:p.lat, lng:p.lng });
      // A paid listing is never swallowed by a cluster — put it straight on the map.
      if (!single && p.promoted) { m.setMap(map); } else { clusterMarkers.push(m); }
      return m;
    });
    if (single) {
      markers.forEach(function(m){ m.setMap(map); });
    } else if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
      window.__clCluster = new markerClusterer.MarkerClusterer({
        map: map, markers: clusterMarkers,
        algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 90, maxZoom: 16 }),
        renderer: { render: function(o){ return new google.maps.Marker({ position:o.position, zIndex:1000+o.count, optimized: false, icon:{ url: uri(clusterSvg(o.count)), scaledSize: new google.maps.Size(40,40), anchor: new google.maps.Point(20,20) } }); } },
      });
      // Re-cluster only AFTER the map settles (debounced), never on intermediate zoom
      // frames. Both our live double-tap zoom and native two-finger pinch emit many
      // 'idle' events while zooming; the clusterer renders (removes + re-adds pins) on
      // each → visible flicker. Debouncing collapses them into ONE clean re-cluster once
      // motion stops, so the pins hold steady through the whole gesture. This replaces
      // the clusterer's own idle→render binding (and the double-tap-only pause), covering
      // pinch too.
      try {
        var __c = window.__clCluster;
        if (__c && __c.idleListener) google.maps.event.removeListener(__c.idleListener);
        var __rt = null;
        __c.idleListener = map.addListener('idle', function(){
          if (__rt) clearTimeout(__rt);
          __rt = setTimeout(function(){ __rt = null; try { __c.render(); } catch(e){} }, 140);
        });
      } catch(e){}
    } else {
      clusterMarkers.forEach(function(m){ m.setMap(map); });
    }
    if (${fit} && pts.length > 1) { try { map.fitBounds(bounds, 40); } catch(e){} }
    window.__clMap = map;
    // A "you are here" fly-to that arrived before the map was ready (WebView reload) — apply it now.
    if (window.__clPendingYou) { try { __clDrawYou(window.__clPendingYou.lat, window.__clPendingYou.lng); } catch(e){} window.__clPendingYou = null; }
    // A view-restore queued before the map was ready (near-me deselect) — apply it now.
    if (window.__clPendingRestore) { try { __clDoRestore(window.__clPendingRestore.lat, window.__clPendingRestore.lng, window.__clPendingRestore.zoom); } catch(e){} window.__clPendingRestore = null; }
    // Report the map view (center+zoom) to RN on every idle, so it can save the
    // pre-near-me position and restore it on deselect (mirrors the website).
    if (!single) { map.addListener('idle', function(){ try { var c = map.getCenter(); if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage('__view__:' + c.lat() + ',' + c.lng() + ',' + map.getZoom()); } } catch(e){} }); }
    // Browse map only: a plain tap on the map (not a pin) tells RN to exit near-me.
    if (!single) { map.addListener('click', function(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage('__near_off__'); } }); }
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
    var active = false, originX = 0, originY = 0, startZoom = 0, targetScale = 1, raf = null, anchorWorld = null;
    // The live preview only scales the #map div UP (zoom-in). Zoom-out does NOT
    // shrink the div — shrinking exposes the blank page behind it (a small map
    // square with blank margins). Zoom-out instead holds still and commits once on
    // release via moveCamera (instant), so the wider tiles load a single time.
    // Counter-scale the fixed-size marker icons so they DON'T grow with the tiles
    // during the preview (that "pins balloon, then snap back on release" glitch).
    // Only our SVG-data-URI icons (pins/clusters/you-dot) match; raster map tiles
    // are untouched. Each icon is centre-anchored, so a centre-origin inverse
    // scale keeps it the same size AND geo-anchored while the map scales around it.
    function scaleMarkers(inv){
      var imgs = el.querySelectorAll('img[src^="data:image/svg"]');
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.transformOrigin = 'center center';
        imgs[i].style.transform = inv === 1 ? '' : 'scale(' + inv + ')';
      }
    }
    function paint(){
      raf = null; if (!active) return;
      // Drive the REAL map zoom live for BOTH directions (fractional zoom), pinned to the
      // tap point. No CSS transform anywhere => no transform→render handoff on release =>
      // no jump on double-tap zoom-in (that little glitch was the CSS-scaled preview
      // snapping to a freshly-rendered committed zoom). This matches the smooth two-finger
      // pinch, which is also a real live zoom.
      var lz = startZoom + Math.log(targetScale) / Math.LN2;   // fractional zoom target
      lz = Math.max(MINZ, Math.min(MAXZ, lz));
      var proj = (typeof map.getProjection === 'function') ? map.getProjection() : null;
      if (anchorWorld && proj) {
        var s1 = 256 * Math.pow(2, lz);
        var nx = anchorWorld.x - (anchorWorld.px - anchorWorld.cx) / s1;
        var ny = anchorWorld.y - (anchorWorld.py - anchorWorld.cy) / s1;
        try { map.moveCamera({ center: proj.fromPointToLatLng(new google.maps.Point(nx, ny)), zoom: lz }); return; } catch(e){}
      }
      try { map.moveCamera({ zoom: lz }); } catch(e){}         // fallback: zoom about center
    }
    function clearTransform(){ el.style.transform = ''; el.style.transformOrigin = ''; el.style.willChange = 'auto'; scaleMarkers(1); }
    // (Clustering flicker is handled at init by debouncing the clusterer's idle→render,
    // which covers BOTH double-tap and native pinch — see the debounce block in initMap.)
    // Apply the committed view INSTANTLY with moveCamera() (no zoom animation).
    // Zoom-in hands off seamlessly from the CSS grow preview; zoom-out (no preview)
    // jumps straight to the wider view. Either way there is NO multi-level zoom
    // animation or per-level tile reload (that was the "zoom-out lags a few seconds"
    // problem). Falls back to setZoom/setCenter only on older Maps builds.
    function applyView(center, zoom){
      if (typeof map.moveCamera === 'function') {
        try { map.moveCamera(center ? { center: center, zoom: zoom } : { zoom: zoom }); return; } catch(e){}
      }
      map.setZoom(zoom); if (center) map.setCenter(center);
    }
    function commit(){
      // Zoom is applied live & anchored during the drag for BOTH directions now, so on
      // release the map is already at its final view — nothing to re-zoom. Just clean up.
      // (The old separate moveCamera-on-commit is what caused the little jump on double-
      // tap zoom-in: the CSS preview handed off to a fresh render at a hair-different spot.)
      clearTransform();   // clustering re-settles on its own (debounced idle) after release
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
        // Capture the tap point as a zoom-independent world coordinate, so a live
        // zoom-out can keep exactly that point pinned under the finger (same anchoring
        // math commit() uses, but applied every frame).
        anchorWorld = null;
        try {
          var proj0 = map.getProjection();
          if (proj0) {
            var r0 = el.getBoundingClientRect();
            var px0 = originX - r0.left, py0 = originY - r0.top;
            var cx0 = r0.width / 2, cy0 = r0.height / 2;
            var s00 = 256 * Math.pow(2, startZoom);
            var wc0 = proj0.fromLatLngToPoint(map.getCenter());
            anchorWorld = { x: wc0.x + (px0 - cx0) / s00, y: wc0.y + (py0 - cy0) / s00, px: px0, py: py0, cx: cx0, cy: cy0 };
          }
        } catch(e){}
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
  // Draw / move the "you are here" marker and recenter on it.
  function __clDrawYou(lat, lng){
    var map = window.__clMap; if (!map) return;
    var p = { lat: lat, lng: lng };
    try { map.panTo(p); map.setZoom(14); } catch(e){}
    if (window.__clYou) { try { window.__clYou.setMap(null); } catch(e){} }
    window.__clYou = new google.maps.Marker({
      position: p, map: map, zIndex: 99999, optimized: false,
      icon: { url: uri(youSvg()), scaledSize: new google.maps.Size(22,22), anchor: new google.maps.Point(11,11) },
    });
  }
  // Called from React Native via injectJavaScript(). If the map isn't ready yet —
  // the WebView reloads whenever near-me changes the pin set — stash the location
  // and initMap() applies it once the map exists, so the dot never gets lost.
  window.__clFlyTo = function(lat, lng){
    if (!window.__clMap) { window.__clPendingYou = { lat: lat, lng: lng }; return; }
    __clDrawYou(lat, lng);
  };
  // Restore a saved center+zoom (near-me deselect). Queues if the map isn't ready.
  function __clDoRestore(lat, lng, zoom){
    var map = window.__clMap; if (!map) return;
    try { map.setZoom(zoom); map.setCenter({ lat: lat, lng: lng }); } catch(e){}
  }
  window.__clRestoreView = function(lat, lng, zoom){
    if (!window.__clMap) { window.__clPendingRestore = { lat: lat, lng: lng, zoom: zoom }; return; }
    __clDoRestore(lat, lng, zoom);
  };
  window.initMap = initMap;
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap&loading=async"></script>
</body></html>`;
}

export default function PropertyMap({ listings = [], style, single = null, isFiltered = false, onMarkerPress, userLocation = null, nearMe = false, onToggleNear, locating = false }) {
  const pts = single ? (single.lat && single.lng ? [single] : []) : listings.filter((l) => l.lat && l.lng);
  const webRef = useRef(null);
  const lastViewRef = useRef(null);        // latest {lat,lng,zoom} reported by the map on idle
  const prevViewRef = useRef(null);         // view saved when near-me is turned ON
  const pendingRestoreRef = useRef(null);   // view to re-apply after the deselect reload
  const prevNearRef = useRef(nearMe);       // previous nearMe, to detect on/off transitions
  // Show the "near me" triangle toggle on the browse map only (not the single-property mini-map).
  const showLocate = !single && typeof onToggleNear === 'function';

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

  const restoreView = (v) => {
    if (!v || !webRef.current) return;
    webRef.current.injectJavaScript(`window.__clRestoreView && window.__clRestoreView(${v.lat}, ${v.lng}, ${v.zoom}); true;`);
  };

  // When near-me turns on (or the user's coords arrive), fly to them + drop the dot.
  useEffect(() => { if (nearMe && userLocation) flyTo(userLocation); }, [nearMe, userLocation?.latitude, userLocation?.longitude]);

  // Save the map view when near-me turns ON; queue a restore of it when it turns OFF
  // (the WebView reloads on toggle, so the actual restore runs in onLoadEnd). Mirrors
  // the website's prevViewRef save/restore.
  useEffect(() => {
    const was = prevNearRef.current;
    if (!was && nearMe) {
      prevViewRef.current = lastViewRef.current;
    } else if (was && !nearMe && prevViewRef.current) {
      pendingRestoreRef.current = prevViewRef.current;
      prevViewRef.current = null;
    }
    prevNearRef.current = nearMe;
  }, [nearMe]);

  // Only the single-property mini-map falls back to a placeholder when it has no
  // coords. The browse map ALWAYS renders (with the triangle) — even when a filter
  // (e.g. near-me far from any listing) yields zero pins — so you can still deselect.
  if (!pts.length && !showLocate) {
    return (
      <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center', padding: 20 }, style]}>
        <Text style={{ fontFamily: fonts.mono, color: colors.ink60, fontSize: 12 }}>Sin ubicación</Text>
      </View>
    );
  }

  const onMessage = (e) => {
    const data = e?.nativeEvent?.data;
    if (!data) return;
    // The map reports its center+zoom on every idle → keep the latest so we can
    // save it when near-me turns on and restore it on deselect.
    if (data.indexOf('__view__:') === 0) {
      const p = data.slice(9).split(',');
      const lat = Number(p[0]), lng = Number(p[1]), zoom = Number(p[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(zoom)) lastViewRef.current = { lat, lng, zoom };
      return;
    }
    // A tap on the empty map (not a pin) exits near-me — mirrors the website.
    if (data === '__near_off__') { if (nearMe && onToggleNear) onToggleNear(); return; }
    if (onMarkerPress) onMarkerPress(data);
    else router.push(`/property/${data}`);
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
        // The HTML re-memoizes when near-me changes the pin set, so the WebView
        // reloads. After each (re)load: if near-me is on, re-drop the "you are here"
        // dot; if it just turned off, restore the pre-near-me view (like the website).
        onLoadEnd={() => {
          if (nearMe && userLocation) flyTo(userLocation);
          else if (!nearMe && pendingRestoreRef.current) { const v = pendingRestoreRef.current; pendingRestoreRef.current = null; restoreView(v); }
        }}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
      {showLocate ? (
        <Pressable
          onPress={onToggleNear}
          accessibilityLabel={nearMe ? 'Near me (on)' : 'Near me'}
          hitSlop={8}
          style={({ pressed }) => [{
            position: 'absolute', right: 16, bottom: 92,
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            // Selected = white button with an ink ring (matches the website).
            borderWidth: nearMe ? 2 : 0, borderColor: colors.ink,
            ...locateShadow,
          }, pressed && { transform: [{ translateY: 1 }] }]}
        >
          {locating ? <ActivityIndicator size="small" color={LOCATE_INK} /> : <NavTriangle size={19} color={nearMe ? colors.ink : LOCATE_INK} />}
        </Pressable>
      ) : null}
    </View>
  );
}
