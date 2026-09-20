// Inline neighborhood field that IS a Google Places autocomplete — the dropdown
// opens directly under the input as you type (like the website), on the same page.
// It's a tiny WebView (needed to reuse the site's referrer-restricted Maps key via
// baseUrl = country origin) that grows its height to fit the suggestions dropdown.
// Typing syncs back to RN (onChangeText); picking a suggestion fills neighborhood +
// city + coordinates (onPick).
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const MAPS_KEY = 'AIzaSyBRMxUxsq4taEGbcelOv-IvlJk6R36IbLA';

function buildHtml(cc, placeholder, initial) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#f9f4ee;font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif}
  #ac{width:100%;box-sizing:border-box;padding:12px 14px;font-size:15px;border:1.5px solid rgba(17,17,17,0.12);border-radius:14px;outline:none;background:#fff;color:#111;-webkit-appearance:none}
  #ac:focus{border-color:#111}
  .pac-container{border:1.5px solid #111;border-radius:14px;margin-top:6px;box-shadow:none;background:#fff;font-family:inherit;overflow:hidden;width:100% !important;left:0 !important}
  .pac-logo:after{display:none !important}
  .pac-item{padding:11px 13px;font-size:14px;line-height:1.3;color:#6b6862;cursor:pointer;border-top:1px solid #eee}
  .pac-item:first-child{border-top:none}
  .pac-item-query{font-size:14px;color:#111}
  .pac-matched{font-weight:700}
  .pac-icon{margin:2px 8px 0 0}
</style></head><body>
<input id="ac" placeholder="${placeholder}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
<script>
function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
function reportH(){
  var input=document.getElementById('ac');
  var base=input.offsetTop + input.offsetHeight;
  var pac=document.querySelector('.pac-container');
  var visible = pac && pac.offsetParent!==null && pac.offsetHeight>0 && document.activeElement===input;
  post({ type:'height', value: visible ? (base + pac.offsetHeight + 10) : (base + 4) });
}
function initMap(){
  var input=document.getElementById('ac');
  input.value = ${JSON.stringify(initial || '')};
  var ac=new google.maps.places.Autocomplete(input,{ fields:['address_components','geometry'], types:['geocode'], componentRestrictions:{country:'${cc}'} });
  ac.addListener('place_changed', function(){
    var p=ac.getPlace()||{}, hood='', city='', lat=null, lng=null;
    (p.address_components||[]).forEach(function(c){ var ty=c.types||[];
      if(!hood && (ty.indexOf('neighborhood')>=0||ty.indexOf('sublocality')>=0||ty.indexOf('sublocality_level_1')>=0)) hood=c.long_name;
      if(!city && (ty.indexOf('locality')>=0||ty.indexOf('administrative_area_level_2')>=0)) city=c.long_name;
    });
    if(p.geometry&&p.geometry.location){ lat=p.geometry.location.lat(); lng=p.geometry.location.lng(); }
    post({ type:'pick', neighborhood:hood, city:city, lat:lat, lng:lng });
    setTimeout(reportH, 60);
  });
  input.addEventListener('input', function(){ post({ type:'input', value: input.value }); });
  input.addEventListener('focus', function(){ setTimeout(reportH, 60); });
  input.addEventListener('blur', function(){ setTimeout(reportH, 200); });
  setInterval(reportH, 300);
  reportH();
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=initMap&loading=async"></script>
</body></html>`;
}

export default function NeighborhoodAutocomplete({ value = '', onChangeText, onPick, origin, countryCode, placeholder = '', lang = 'es' }) {
  const [h, setH] = useState(56);
  const initialRef = useRef(value); // only the FIRST value seeds the input (avoids fighting the WebView)

  const onMessage = (e) => {
    let m; try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'height') { setH(Math.min(360, Math.max(56, Math.round(m.value)))); return; }
    if (m.type === 'input') { onChangeText && onChangeText(m.value || ''); return; }
    if (m.type === 'pick') { onPick && onPick({ neighborhood: m.neighborhood || '', city: m.city || '', latitude: m.lat, longitude: m.lng }); }
  };

  return (
    <View style={{ height: h }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(String(countryCode || 'py').toLowerCase(), placeholder, initialRef.current), baseUrl: origin || 'https://casa-libre.com.py' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        keyboardDisplayRequiresUserAction={false}
        scrollEnabled={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
