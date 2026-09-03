/**
 * Газрын зургийн WebView-д ачаалагдах HTML.
 *
 * ⚠️ Яагаад WebView вэ: Google Maps SDK нь Android дээр төлбөртэй,
 * биллинг холбосон API түлхүүр ЗААВАЛ шаарддаг бөгөөд түлхүүргүй үед
 * натив талдаа `IllegalStateException` шидэж бүтэн аппыг унагаадаг.
 * OpenStreetMap нь түлхүүр шаарддаггүй тул энэ эрсдэл бүрмөсөн арилна.
 *
 * Энэ файл нь ЦЭВЭР TEMPLATE — React талаас зөвхөн `window.__mapSet(...)`
 * дуудлагаар төлөв (marker, circle, харагдах муж) очно. Дотор нь
 * template literal (backtick) ХЭРЭГЛЭХГҮЙ — RN тал үүнийг мөрөнд
 * шигтгэж `injectJavaScript` хийдэг тул зөрчилдөнө.
 */

// Leaflet-ийг CDN-ээс ачаална. Tile өөрөө интернэт шаарддаг тул энэ нь
// нэмэлт хамаарал биш — офлайн үед аль аль нь ажиллахгүй.
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

/** Хэрэглэгчийн өгсөн текстийг HTML-д аюулгүй шигтгэнэ. */
const ESCAPE_FN = `
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}`;

export function buildMapHtml({ region, scrollEnabled = true, zoomEnabled = true, dark = false }) {
  const center = region
    ? [Number(region.latitude), Number(region.longitude)]
    : [47.9184, 106.9177];
  const delta = region?.latitudeDelta != null ? Number(region.latitudeDelta) : 0.08;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="stylesheet" href="${LEAFLET_CSS}">
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  body { background: ${dark ? '#12161C' : '#E9EEF3'}; -webkit-tap-highlight-color: transparent; }
  .leaflet-container { background: ${dark ? '#12161C' : '#E9EEF3'}; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-control-attribution { font-size: 9px; opacity: .65; }

  /* Байршлын нэрийн шошго */
  .gx-label {
    display: inline-block; white-space: nowrap;
    padding: 5px 10px; border-radius: 999px;
    background: #0099DB; color: #fff;
    font-size: 12px; font-weight: 700; line-height: 1;
    box-shadow: 0 2px 6px rgba(0,0,0,.28);
    transform: translate(-50%, -50%);
  }
  .gx-label.dim { background: rgba(90,102,114,.85); }

  /* Аватар тэмдэг */
  .gx-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    border: 3px solid #fff; background: #0099DB;
    color: #fff; font-size: 16px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    transform: translate(-50%, -50%);
  }
  .gx-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .gx-avatar.focused { box-shadow: 0 0 0 6px rgba(0,153,219,.28), 0 2px 8px rgba(0,0,0,.35); }

  /* Сонгодог дусал хэлбэрийн pin */
  .gx-pin {
    width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
    background: #0099DB; border: 2.5px solid #fff;
    transform: translate(-50%, -100%) rotate(-45deg);
    box-shadow: 0 2px 5px rgba(0,0,0,.3);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS}"></script>
<script>
(function () {
${ESCAPE_FN}

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    dragging: ${scrollEnabled ? 'true' : 'false'},
    touchZoom: ${zoomEnabled ? 'true' : 'false'},
    doubleClickZoom: ${zoomEnabled ? 'true' : 'false'},
    scrollWheelZoom: ${zoomEnabled ? 'true' : 'false'},
    boxZoom: false,
    keyboard: false,
    tap: true,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  // latitudeDelta -> zoom. react-native-maps-ийн муж загварыг Leaflet-ийн
  // хүрээ болгож хөрвүүлнэ (өндөрийн градусаар).
  function boundsOf(r) {
    var dLat = Number(r.latitudeDelta != null ? r.latitudeDelta : 0.02);
    var dLng = Number(r.longitudeDelta != null ? r.longitudeDelta : dLat);
    var lat = Number(r.latitude), lng = Number(r.longitude);
    return [[lat - dLat / 2, lng - dLng / 2], [lat + dLat / 2, lng + dLng / 2]];
  }

  map.fitBounds(boundsOf({ latitude: ${center[0]}, longitude: ${center[1]}, latitudeDelta: ${delta} }));

  map.on('click', function (e) {
    post({ type: 'press', latitude: e.latlng.lat, longitude: e.latlng.lng });
  });

  var markerLayer = L.layerGroup().addTo(map);
  var circleLayer = L.layerGroup().addTo(map);
  // Замнал (өдрийн байршлын түүх) — маркерын ДООР зурагдана.
  var pathLayer = L.layerGroup().addTo(map);

  function iconFor(m) {
    if (m.avatarUri || m.avatarName) {
      var inner = m.avatarUri
        ? '<img src="' + esc(m.avatarUri) + '">'
        : esc(String(m.avatarName || '?').trim().charAt(0).toUpperCase());
      var tint = m.tint ? ' style="background:' + esc(m.tint) + '"' : '';
      return L.divIcon({
        className: '',
        iconSize: null,
        html: '<div class="gx-avatar' + (m.focused ? ' focused' : '') + '"' + tint + '>' + inner + '</div>',
      });
    }
    if (m.label) {
      return L.divIcon({
        className: '',
        iconSize: null,
        html: '<div class="gx-label' + (m.dim ? ' dim' : '') + '">' + esc(m.label) + '</div>',
      });
    }
    var color = m.pinColor === 'green' ? '#3FCF8E'
      : m.pinColor === 'red' ? '#EF5B5B'
      : m.pinColor ? m.pinColor : '#0099DB';
    return L.divIcon({
      className: '',
      iconSize: null,
      html: '<div class="gx-pin" style="background:' + esc(color) + '"></div>',
    });
  }

  window.__mapSet = function (state) {
    markerLayer.clearLayers();
    circleLayer.clearLayers();
    pathLayer.clearLayers();

    /**
     * Замнал — байршлын түүхийн шугам ба цэгүүд.
     *
     * Апп хаалттай үед offline queue-д хуримтлагдаад дараа нь
     * илгээгдсэн цэгүүд location_logs-д ирдэг тул энэ шугам нь
     * тасалдалтай хугацааг ч дүүрэн харуулна.
     */
    (state.paths || []).forEach(function (p) {
      var pts = (p.coords || [])
        .filter(function (c) { return c && c.latitude != null; })
        .map(function (c) { return [c.latitude, c.longitude]; });
      if (pts.length < 1) return;

      if (pts.length >= 2) {
        L.polyline(pts, {
          color: p.color || '#0099DB',
          weight: p.weight || 4,
          opacity: 0.85,
          interactive: false,
        }).addTo(pathLayer);
      }

      // Цэг бүрийг жижиг тойргоор тэмдэглэнэ — хаана зогссон нь харагдана.
      pts.forEach(function (pt, idx) {
        var isEnd = idx === pts.length - 1;
        var isStart = idx === 0;
        L.circleMarker(pt, {
          radius: isStart || isEnd ? 5 : 3,
          color: isEnd ? '#EF5B5B' : isStart ? '#3FCF8E' : (p.color || '#0099DB'),
          weight: 2,
          fillColor: '#fff',
          fillOpacity: 1,
          interactive: false,
        }).addTo(pathLayer);
      });
    });

    (state.circles || []).forEach(function (c) {
      if (c.latitude == null) return;
      L.circle([c.latitude, c.longitude], {
        radius: Number(c.radius) || 0,
        color: c.strokeColor || 'rgba(0,153,219,.6)',
        weight: c.strokeWidth == null ? 1 : Number(c.strokeWidth),
        fillColor: c.fillColor || 'rgba(0,153,219,.15)',
        fillOpacity: 1,
        interactive: false,
      }).addTo(circleLayer);
    });

    (state.markers || []).forEach(function (m, i) {
      if (m.latitude == null) return;
      var mk = L.marker([m.latitude, m.longitude], {
        icon: iconFor(m),
        zIndexOffset: Number(m.zIndex || 0) * 100,
        keyboard: false,
      });
      if (m.title || m.description) {
        mk.bindPopup(
          '<b>' + esc(m.title || '') + '</b>' +
          (m.description ? '<br>' + esc(m.description) : '')
        );
      }
      mk.on('click', function () { post({ type: 'markerPress', index: i }); });
      mk.addTo(markerLayer);
    });
  };

  window.__mapAnimate = function (region, duration) {
    map.flyToBounds(boundsOf(region), { duration: Math.max(0.2, (duration || 500) / 1000) });
  };

  window.__mapFit = function (coords, padding) {
    if (!coords || !coords.length) return;
    map.fitBounds(coords.map(function (c) { return [c.latitude, c.longitude]; }), {
      padding: [padding || 40, padding || 40],
    });
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
