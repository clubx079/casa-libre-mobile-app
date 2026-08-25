// Map of listings using Leaflet + OpenStreetMap inside a WebView. This works in
// Expo Go (react-native-webview is bundled) — unlike react-native-maps, which
// needs a custom native build. Price-pill markers; tapping one opens the listing.
import { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import { colors, fonts } from '../lib/theme';
import { shortUsd } from '../lib/format';
import { ASUNCION } from '../lib/config';

function buildHtml(points, center, zoom, single, fitBounds) {
  const data = JSON.stringify(points);
  const fit = fitBounds ? 'true' : 'false';
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e9e6df;}
  .pill{background:#111;color:#f9f4ee;font-family:'Courier New',monospace;font-size:12px;font-weight:600;
        padding:4px 8px;border-radius:999px;border:1.5px solid #f9f4ee;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4);}
  .dot{width:16px;height:16px;background:#111;border:3px solid #f9f4ee;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.5);}
  /* Branded cluster bubble (nearby listings grouped, showing the count) */
  .clus{background:#111;color:#f9f4ee;border:2px solid #f9f4ee;border-radius:999px;
        display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;
        font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.45);}
  .leaflet-container{background:#e9e6df;}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
  var pts = ${data};
  var single = ${single ? 'true' : 'false'};
  var map = L.map('map',{attributionControl:false,zoomControl:true}).setView([${center.lat},${center.lng}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var coords=[];
  function makeMarker(p){
    var html = single ? '<div class="dot"></div>' : '<div class="pill">'+p.label+'</div>';
    var icon = L.divIcon({className:'',html:html,iconSize:null,iconAnchor:(single?[8,8]:[0,14])});
    var m = L.marker([p.lat,p.lng],{icon:icon});
    m.on('click',function(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(p.id); } });
    return m;
  }
  if (single) {
    pts.forEach(function(p){ makeMarker(p).addTo(map); coords.push([p.lat,p.lng]); });
  } else {
    // Cluster nearby listings into a numbered bubble; tapping a cluster zooms in.
    var cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: function(c){
        var n = c.getChildCount();
        var size = n < 10 ? 38 : n < 100 ? 46 : 54;
        return L.divIcon({ html: '<div class="clus" style="width:'+size+'px;height:'+size+'px;">'+n+'</div>', className:'', iconSize:[size,size] });
      }
    });
    pts.forEach(function(p){ cluster.addLayer(makeMarker(p)); coords.push([p.lat,p.lng]); });
    map.addLayer(cluster);
  }
  if (${fit} && coords.length>1){ try{ map.fitBounds(coords,{padding:[40,40],maxZoom:15}); }catch(e){} }
</script></body></html>`;
}

export default function PropertyMap({ listings = [], style, single = null, isFiltered = false, onMarkerPress }) {
  const pts = single ? (single.lat && single.lng ? [single] : []) : listings.filter((l) => l.lat && l.lng);

  const html = useMemo(() => {
    const points = pts.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: shortUsd(l.usd) }));
    // Default view is always Asunción; only fit-to-markers once a filter/search
    // narrows the set (matches the website behavior).
    const center = single && single.lat ? { lat: single.lat, lng: single.lng } : { lat: ASUNCION.latitude, lng: ASUNCION.longitude };
    const zoom = single ? 15 : 12;
    const fitBounds = !single && isFiltered;
    return buildHtml(points, center, zoom, !!single, fitBounds);
  }, [pts.length, single?.id, isFiltered]);

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
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://casa-libre.com.py' }}
        style={{ flex: 1, backgroundColor: colors.hatch }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  );
}
