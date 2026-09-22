// Map of listings using GOOGLE MAPS (JS API) inside a WebView — same basemap
// style, brand pills and clustering as the website (utils/gmap.js). Rendering in
// a WebView (not native react-native-maps) keeps it working in Expo Go AND lets
// us reuse the site's referrer-restricted Maps key: the WebView's baseUrl is
// casa-libre.com.py, so Google accepts the key. Price-pill markers; tapping one
// posts the listing id back to RN. Google's logo/attribution are hidden with CSS
// to match the site's clean brand look.
import { forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
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
export const LOCATE_INK = '#3c4043';
export function NavTriangle({ size = 19, color = LOCATE_INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ transform: [{ rotate: '45deg' }] }}>
      <Path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" />
    </Svg>
  );
}

// Soft drop shadow matching the website's shadow-[0_1px_4px_rgba(0,0,0,0.3)] —
// deliberately NOT the brand hard-offset shadow; the site's locate control is a
// standard Google-style floating button.
export const locateShadow = {
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
  { elementType: 'geometry', stylers: [{ color: '#D8CBB2' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#403E37' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#E7DCC6' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#C2CFA4' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FBF7EF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#C6B99F' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F6F0E3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EFE6D2' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#BCAE91' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#AFC3BA' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b7a73' }] },
];

function buildHtml(points, center, zoom, single) {
  const data = JSON.stringify(points);
  const style = JSON.stringify(CL_MAP_STYLE);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#D8CBB2;overflow:hidden;}
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
  // SELECTED pin (the one shown in the preview carousel): the inverse of a normal
  // pin — paper fill, ink text + ring — at 1.3x with a soft drop shadow, so it
  // stands out from the ink pins around it.
  function selSvg(label){
    var t = String(label == null ? '•' : label);
    var h = 32, w = Math.max(40, Math.round(22 + t.length * 9.8)), P = 6;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='"+(w+P*2)+"' height='"+(h+P*2)+"'>"
      + "<defs><filter id='s' x='-30%' y='-30%' width='160%' height='170%'><feDropShadow dx='0' dy='2' stdDeviation='2.2' flood-color='#000' flood-opacity='0.35'/></filter></defs>"
      + "<rect x='"+(P+1.5)+"' y='"+(P+1.5)+"' width='"+(w-3)+"' height='"+(h-3)+"' rx='"+((h-3)/2)+"' fill='"+CREAM+"' stroke='"+INK+"' stroke-width='2.5' filter='url(#s)'/>"
      + "<text x='"+(P+w/2)+"' y='"+(P+h/2+1)+"' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='15' font-weight='700' fill='"+INK+"'>"+t+"</text></svg>";
  }
  function selIcon(p){
    var t = String(p.label||'•'), P = 6, h = 32 + P*2, w = Math.max(40, Math.round(22 + t.length * 9.8)) + P*2;
    return { url: uri(selSvg(p.label)), scaledSize: new google.maps.Size(w,h), anchor: new google.maps.Point(w/2, h/2) };
  }
  function post(m){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); }
  function clusterSvg(n){
    var s = 40;
    return "<svg xmlns='http://www.w3.org/2000/svg' width='"+s+"' height='"+s+"'>"
      + "<circle cx='"+(s/2)+"' cy='"+(s/2)+"' r='"+(s/2-2)+"' fill='"+INK+"' stroke='"+CREAM+"' stroke-width='2'/>"
      + "<text x='"+(s/2)+"' y='"+(s/2+1)+"' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' font-weight='700' fill='"+CREAM+"'>"+n+"</text></svg>";
  }
  // ── Browse-map state. React Native owns filters/selection and drives the map
  // through the window.__cl* functions below (injectJavaScript) — the WebView is
  // never reloaded to change pins, so the camera stays wherever the user left it.
  var byId = {};          // id -> { m: Marker, p: point }
  var selId = null;       // currently highlighted listing id
  var insetBottom = 0;    // px hidden under the RN bottom sheet (excluded from reported bounds)
  var moving = false;
  function makeMarker(p){
    var m = new google.maps.Marker({ position:{ lat:p.lat, lng:p.lng }, icon: pillIcon(p), optimized: false, zIndex: p.promoted ? 10000 : undefined });
    m.addListener('click', function(){ post(p.id); });
    return m;
  }
  function setPoints(arr){
    var map = window.__clMap, cl = window.__clCluster;
    if (cl) { try { cl.clearMarkers(true); } catch(e){} }
    for (var k in byId) { try { byId[k].m.setMap(null); } catch(e){} }
    byId = {};
    var keepSel = selId; selId = null;
    var cm = [];
    (arr || []).forEach(function(p){
      var m = makeMarker(p); byId[p.id] = { m: m, p: p };
      // A paid listing is never swallowed by a cluster — put it straight on the map.
      if (p.promoted || !cl) m.setMap(map); else cm.push(m);
    });
    if (cl) { try { cl.addMarkers(cm); } catch(e){} }
    if (keepSel && byId[keepSel]) select(keepSel);
  }
  function select(id){
    var map = window.__clMap, cl = window.__clCluster;
    if (selId && byId[selId]) {
      var o = byId[selId];
      o.m.setIcon(pillIcon(o.p)); o.m.setZIndex(o.p.promoted ? 10000 : undefined);
      if (!o.p.promoted && cl) { o.m.setMap(null); try { cl.addMarker(o.m); } catch(e){} }
    }
    selId = null;
    if (id && byId[id]) {
      var n = byId[id];
      // Lift it out of its cluster while selected so it's always visible.
      if (!n.p.promoted && cl) { try { cl.removeMarker(n.m); } catch(e){} }
      n.m.setMap(map); n.m.setIcon(selIcon(n.p)); n.m.setZIndex(20000);
      selId = id;
    }
  }
  function reportBounds(map){
    var b = map.getBounds(); if (!b) return;
    var ne = b.getNorthEast(), sw = b.getSouthWest();
    var h = document.getElementById('map').clientHeight || 1;
    var n = ne.lat(), s = sw.lat();
    s = s + (n - s) * Math.min(0.9, insetBottom / h);   // the strip under the sheet isn't "on the map"
    post('__bounds__:' + n + ',' + s + ',' + ne.lng() + ',' + sw.lng() + ',' + map.getZoom());
  }
  function initMap(){
    var map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: ${center.lat}, lng: ${center.lng} }, zoom: ${zoom},
      styles: CL_STYLE, disableDefaultUI: true, clickableIcons: false, keyboardShortcuts: false, gestureHandling: 'greedy',
      // Fractional zoom keeps the double-tap-drag gesture (below) buttery instead
      // of snapping between integer levels (raster maps default this to false).
      isFractionalZoomEnabled: true,
    });
    window.__clMap = map;
    if (single) {
      pts.forEach(function(p){
        new google.maps.Marker({ map: map, position:{ lat:p.lat, lng:p.lng }, optimized: false,
          icon: { url: uri(dotSvg()), scaledSize: new google.maps.Size(16,16), anchor: new google.maps.Point(8,8) } });
      });
    } else {
      if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
        window.__clCluster = new markerClusterer.MarkerClusterer({
          map: map, markers: [],
          algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 90, maxZoom: 16 }),
          renderer: { render: function(o){ return new google.maps.Marker({ position:o.position, zIndex:1000+o.count, optimized: false, icon:{ url: uri(clusterSvg(o.count)), scaledSize: new google.maps.Size(40,40), anchor: new google.maps.Point(20,20) } }); } },
          // Cluster tap: zoom into it (default behaviour) and tell RN (closes the preview).
          onClusterClick: function(ev, cluster, m){ try { m.fitBounds(cluster.bounds); } catch(e){} post('__cluster__'); },
        });
        // Re-cluster only AFTER the map settles (debounced), never on intermediate zoom
        // frames — double-tap-drag and pinch both emit many 'idle' events; rendering on
        // each flickers the pins. One clean re-cluster once motion stops.
        try {
          var __c = window.__clCluster;
          if (__c && __c.idleListener) google.maps.event.removeListener(__c.idleListener);
          var __rt = null;
          __c.idleListener = map.addListener('idle', function(){
            if (__rt) clearTimeout(__rt);
            __rt = setTimeout(function(){ __rt = null; try { __c.render(); } catch(e){} }, 140);
          });
        } catch(e){}
      }
      setPoints(window.__clPts || pts);
      if (window.__clSel) select(window.__clSel);
      // Motion protocol: one __moving__ per gesture/animation, then __bounds__ on idle.
      map.addListener('bounds_changed', function(){ if (!moving) { moving = true; post('__moving__'); } });
      map.addListener('idle', function(){ moving = false; reportBounds(map); });
      map.addListener('click', function(){ post('__map_tap__'); });
      if (window.__clPendingFit) { var f = window.__clPendingFit; window.__clPendingFit = null; window.__clFitTo(f[0], f[1], f[2]); }
    }
    if (window.__clPendingYou) { try { __clDrawYou(window.__clPendingYou.lat, window.__clPendingYou.lng); } catch(e){} window.__clPendingYou = null; }
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
  // ── Called from React Native via injectJavaScript(). Each one queues its input
  // if the Google script hasn't finished loading yet, and initMap() applies it.
  window.__clFlyTo = function(lat, lng){
    if (!window.__clMap) { window.__clPendingYou = { lat: lat, lng: lng }; return; }
    __clDrawYou(lat, lng);
  };
  window.__clHideYou = function(){ window.__clPendingYou = null; if (window.__clYou) { try { window.__clYou.setMap(null); } catch(e){} window.__clYou = null; } };
  window.__clSetPoints = function(arr){ window.__clPts = arr; if (window.__clMap && !single) setPoints(arr); };
  window.__clSelect = function(id){ window.__clSel = id; if (window.__clMap && !single) select(id); };
  window.__clSetInsets = function(bottom){ insetBottom = bottom || 0; };
  // Fit the camera to [[lat,lng],…] leaving room for the search bar (top) and sheet (bottom).
  window.__clFitTo = function(arr, top, bottom){
    var map = window.__clMap;
    if (!map) { window.__clPendingFit = [arr, top, bottom]; return; }
    if (!arr || !arr.length) return;
    if (arr.length === 1) { map.setCenter({ lat: arr[0][0], lng: arr[0][1] }); map.setZoom(15); return; }
    var bb = new google.maps.LatLngBounds();
    arr.forEach(function(p){ bb.extend({ lat: p[0], lng: p[1] }); });
    try { map.fitBounds(bb, { top: top || 80, bottom: bottom || 80, left: 40, right: 40 }); } catch(e){ map.fitBounds(bb); }
  };
  // Pan (never zoom) so a point sits in the free band between the search bar (top px)
  // and the preview/sheet (bottom px) — only if it isn't already visible there.
  window.__clEnsureVisible = function(lat, lng, top, bottom){
    var map = window.__clMap; if (!map) return;
    var b = map.getBounds(); if (!b) return;
    var ne = b.getNorthEast(), sw = b.getSouthWest();
    var h = document.getElementById('map').clientHeight || 1;
    var span = ne.lat() - sw.lat();
    var topLat = ne.lat() - span * (top / h), botLat = sw.lat() + span * (bottom / h);
    var w = sw.lng(), e = ne.lng();
    var inLng = e >= w ? (lng >= w && lng <= e) : (lng >= w || lng <= e);
    if (inLng && lat <= topLat && lat >= botLat) return;
    map.panTo({ lat: lat - span * ((bottom - top) / 2) / h, lng: lng });
  };
  window.__clZoomOut = function(){
    var map = window.__clMap; if (!map) return;
    map.setZoom(Math.max(3, Math.floor(map.getZoom()) - 1));
  };
  window.initMap = initMap;
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap&loading=async"></script>
</body></html>`;
}

const toPoint = (l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: shortUsd(l.usd), promoted: !!(l.verified || l.plan) });

// Browse map (listings) or the property page's single-pin mini-map (`single`).
// Browse-mode props: onMoving() when the camera starts moving, onBounds(msg) with
// "__bounds__:n,s,e,w,zoom" when it settles, onMapTap / onClusterTap, selectedId
// (highlighted pin), bottomInset (px covered by the sheet). Ref: fitTo, flyTo,
// ensureVisible, zoomOut.
const PropertyMap = forwardRef(function PropertyMap({ listings = [], style, single = null, onMarkerPress, onMoving, onBounds, onMapTap, onClusterTap, selectedId = null, bottomInset = 0, userLocation = null, nearMe = false }, ref) {
  // Memoised so a selection change (which re-renders on every carousel swipe)
  // never re-walks the whole catalogue.
  const pts = useMemo(
    () => (single ? (single.lat && single.lng ? [single] : []) : listings.filter((l) => l.lat != null && l.lng != null)),
    [listings, single?.id, single?.lat, single?.lng],
  );
  const webRef = useRef(null);
  const country = getCountry();

  // Built once per country (or per property on the mini-map). Browse pins are
  // pushed in afterwards, so filters never reload the WebView / reset the camera.
  const html = useMemo(() => {
    const points = single ? pts.map(toPoint) : [];
    const mc = getMapCenter();
    const center = single && single.lat ? { lat: single.lat, lng: single.lng } : { lat: mc.latitude, lng: mc.longitude };
    const zoom = single ? country.singleZoom : country.mapZoom;
    return buildHtml(points, center, zoom, !!single);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single?.id, country.code]);

  const points = useMemo(() => pts.map(toPoint), [pts]);
  const inject = (js) => { if (webRef.current) webRef.current.injectJavaScript(`try{${js}}catch(e){}; true;`); };
  const pushPoints = () => { if (!single) inject(`window.__clSetPoints && window.__clSetPoints(${JSON.stringify(points)});`); };
  const pushSelect = () => { if (!single) inject(`window.__clSelect && window.__clSelect(${JSON.stringify(selectedId)});`); };
  const pushInsets = () => { if (!single) inject(`window.__clSetInsets && window.__clSetInsets(${Number(bottomInset) || 0});`); };
  const flyTo = (loc) => {
    if (!loc) return;
    const lat = Number(loc.latitude), lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    inject(`window.__clFlyTo && window.__clFlyTo(${lat}, ${lng});`);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { pushPoints(); }, [points]);
  useEffect(() => { pushSelect(); }, [selectedId]);
  useEffect(() => { pushInsets(); }, [bottomInset]);
  useEffect(() => { if (!single && !nearMe) inject('window.__clHideYou && window.__clHideYou();'); }, [nearMe]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useImperativeHandle(ref, () => ({
    fitTo(list, { top = 80, bottom = 80 } = {}) {
      const arr = (list || []).filter((l) => l.lat != null && l.lng != null).map((l) => [Number(l.lat), Number(l.lng)]);
      inject(`window.__clFitTo && window.__clFitTo(${JSON.stringify(arr)}, ${top}, ${bottom});`);
    },
    flyTo,
    ensureVisible(lat, lng, top, bottom) { inject(`window.__clEnsureVisible && window.__clEnsureVisible(${Number(lat)}, ${Number(lng)}, ${top}, ${bottom});`); },
    zoomOut() { inject('window.__clZoomOut && window.__clZoomOut();'); },
  }));

  if (single && !pts.length) {
    return (
      <View style={[{ backgroundColor: colors.hatch, alignItems: 'center', justifyContent: 'center', padding: 20 }, style]}>
        <Text style={{ fontFamily: fonts.mono, color: colors.ink60, fontSize: 12 }}>Sin ubicación</Text>
      </View>
    );
  }

  const onMessage = (e) => {
    const data = e?.nativeEvent?.data;
    if (!data) return;
    if (data === '__moving__') { if (onMoving) onMoving(); return; }
    if (data.indexOf('__bounds__:') === 0) { if (onBounds) onBounds(data); return; }
    if (data === '__map_tap__') { if (onMapTap) onMapTap(); return; }
    if (data === '__cluster__') { if (onClusterTap) onClusterTap(); return; }
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
        // (Re)load — first mount or a country switch: re-push the current pins,
        // insets, selection and the "you are here" dot.
        onLoadEnd={() => { pushInsets(); pushPoints(); pushSelect(); if (nearMe && userLocation) flyTo(userLocation); }}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  );
});

export default PropertyMap;
