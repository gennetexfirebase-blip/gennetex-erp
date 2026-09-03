/**
 * Газрын зураг — OpenStreetMap (Leaflet + WebView).
 *
 * ⚠️ ЯАГААД GOOGLE MAPS БИШ ВЭ:
 *    `react-native-maps` нь Android дээр Google Maps SDK-г ашигладаг
 *    бөгөөд `com.google.android.geo.API_KEY` meta-data байхгүй үед
 *    НАТИВ constructor нь `IllegalStateException: API key not found`
 *    шидэж БҮТЭН аппыг унагаадаг (JS-ийн try/catch, ErrorBoundary
 *    барьж чадахгүй). Ирц дэлгэц газрын зурагтай тул түлхүүргүй build
 *    дээр орох бүрд апп хаагддаг байв. Түүнээс гадна Google Maps нь
 *    биллинг холбосон төлбөртэй түлхүүр шаарддаг.
 *
 *    OpenStreetMap нь ямар ч түлхүүр шаарддаггүй тул энэ бүхэн арилна.
 *
 * API нь `react-native-maps`-тай НИЙЦТЭЙ хэвээр: `MapView` + `Marker` +
 * `Circle` + ref дээрх `animateToRegion` / `fitToCoordinates`. Тиймээс
 * дуудаж буй дэлгэцүүд хэвээрээ ажиллана.
 *
 * Marker-ийн ХҮҮХЭД ЭЛЕМЕНТ (custom React view) нь WebView дотор
 * зурагдах боломжгүй тул түүний оронд дараах props-ыг ашиглана:
 *   label      — дугуй шошго (байршлын нэр)
 *   dim        — шошгыг бүдгэрүүлэх
 *   avatarUri  — дугуй аватар зураг
 *   avatarName — зураггүй үед эхний үсэг
 *   focused    — аватарыг тодруулах цагираг
 *   tint       — аватарын дэвсгэр өнгө
 *   pinColor   — энгийн pin-ий өнгө ('green' | 'red' | css өнгө)
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml } from './mapHtml';

// `react-native-maps`-тай нийцтэй байхын тулд үлдээв. Дуудагч дэлгэцүүд
// `provider={PROVIDER_GOOGLE}` дамжуулсаар байгаа ч эффектгүй.
export const PROVIDER_GOOGLE = 'osm';

// Түлхүүр шаардахгүй тул үргэлж бэлэн.
export const MAPS_READY = true;

/**
 * Тохиргоо тээгч элементүүд — өөрсдөө юу ч зурахгүй. `MapView` нь
 * эдгээрийн props-ыг цуглуулж WebView руу дамжуулна.
 */
export function Marker() {
  return null;
}
Marker.displayName = 'Map.Marker';

export function Circle() {
  return null;
}
Circle.displayName = 'Map.Circle';

/**
 * Замнал — байршлын түүхийн шугам.
 *
 * `react-native-maps`-ийн `Polyline`-тай нийцтэй: `coordinates` массив
 * ба `strokeColor`. Өөрөө юу ч зурахгүй — props нь WebView руу очно.
 */
export function Polyline() {
  return null;
}
Polyline.displayName = 'Map.Polyline';

/**
 * Гүн давхаргатай children-ээс Marker/Circle-ийг цуглуулна.
 *
 * Дуудагч кодууд ихэвчлэн `<>{...}</>` fragment болон массив хольж
 * ашигладаг тул `React.Children.toArray` дангаараа хангалтгүй.
 */
function collect(children, out) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === Marker) {
      out.markers.push(child.props);
    } else if (child.type === Circle) {
      out.circles.push(child.props);
    } else if (child.type === Polyline) {
      out.paths.push(child.props);
    } else if (child.props?.children) {
      collect(child.props.children, out);
    }
  });
  return out;
}

function normalizeMarkers(list) {
  return list.map((p) => ({
    latitude: p.coordinate?.latitude ?? null,
    longitude: p.coordinate?.longitude ?? null,
    title: p.title ?? null,
    description: p.description ?? null,
    pinColor: p.pinColor ?? null,
    label: p.label ?? null,
    dim: !!p.dim,
    avatarUri: p.avatarUri ?? null,
    avatarName: p.avatarName ?? null,
    focused: !!p.focused,
    tint: p.tint ?? null,
    zIndex: p.zIndex ?? 0,
  }));
}

function normalizeCircles(list) {
  return list.map((p) => ({
    latitude: p.center?.latitude ?? null,
    longitude: p.center?.longitude ?? null,
    radius: p.radius ?? 0,
    strokeColor: p.strokeColor ?? null,
    strokeWidth: p.strokeWidth ?? null,
    fillColor: p.fillColor ?? null,
  }));
}

function normalizePaths(list) {
  return list.map((p) => ({
    coords: (p.coordinates || []).map((c) => ({
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
    })),
    color: p.strokeColor ?? null,
    weight: p.strokeWidth ?? null,
  }));
}

const MapView = forwardRef(function MapView(
  {
    style,
    children,
    initialRegion,
    region,
    scrollEnabled = true,
    zoomEnabled = true,
    onPress,
    dark = false,
    // react-native-maps-ийн үлдсэн props — нийцлийн үүднээс залгиж авна.
    provider: _provider,
    showsUserLocation: _showsUserLocation,
    ...rest
  },
  ref
) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const pending = useRef(null);

  // HTML-ийг ЗӨВХӨН нэг удаа үүсгэнэ — дахин үүсгэвэл WebView бүхэлдээ
  // дахин ачаалагдаж, зураг анивчина.
  const firstRegion = useRef(initialRegion || region);
  const html = useMemo(
    () => buildMapHtml({ region: firstRegion.current, scrollEnabled, zoomEnabled, dark }),
    [scrollEnabled, zoomEnabled, dark]
  );

  const { markers, circles, paths } = useMemo(
    () => collect(children, { markers: [], circles: [], paths: [] }),
    [children]
  );

  const payload = useMemo(
    () =>
      JSON.stringify({
        markers: normalizeMarkers(markers),
        circles: normalizeCircles(circles),
        paths: normalizePaths(paths),
      }),
    [markers, circles, paths]
  );

  // Marker/Circle өөрчлөгдөх бүрд төлөвийг WebView руу илгээнэ.
  useEffect(() => {
    if (!ready) {
      pending.current = payload;
      return;
    }
    webRef.current?.injectJavaScript(`window.__mapSet(${payload}); true;`);
  }, [payload, ready]);

  const animateToRegion = useCallback((next, duration = 500) => {
    if (!next) return;
    webRef.current?.injectJavaScript(
      `window.__mapAnimate(${JSON.stringify(next)}, ${Number(duration) || 500}); true;`
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion,
      animateCamera(camera, opts) {
        const c = camera?.center;
        if (!c) return;
        animateToRegion({ ...c, latitudeDelta: 0.01, longitudeDelta: 0.01 }, opts?.duration);
      },
      fitToCoordinates(coords, opts) {
        if (!coords?.length) return;
        const pad = opts?.edgePadding?.top ?? 40;
        webRef.current?.injectJavaScript(
          `window.__mapFit(${JSON.stringify(coords)}, ${Number(pad) || 40}); true;`
        );
      },
    }),
    [animateToRegion]
  );

  const handleMessage = useCallback(
    (event) => {
      let msg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        setReady(true);
        if (pending.current) {
          webRef.current?.injectJavaScript(`window.__mapSet(${pending.current}); true;`);
          pending.current = null;
        }
        return;
      }
      if (msg.type === 'press') {
        // react-native-maps-ийн эвент хэлбэрийг дуурайна.
        onPress?.({
          nativeEvent: { coordinate: { latitude: msg.latitude, longitude: msg.longitude } },
        });
        return;
      }
      if (msg.type === 'markerPress') {
        markers[msg.index]?.onPress?.({
          nativeEvent: { coordinate: markers[msg.index]?.coordinate },
        });
      }
    },
    [markers, onPress]
  );

  return (
    <View style={[styles.wrap, style]} {...rest}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://gennetex.mn' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        style={styles.web}
        // Газрын зураг нь дэлгэцийн ард байдаг тул дэвсгэр ил тод байвал
        // ачаалагдах хооронд цагаан анивчина.
        androidLayerType="hardware"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // Гадаад холбоос дарвал WebView дотор шилжихээс сэргийлнэ.
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('https://gennetex.mn')}
      />
    </View>
  );
});

export { MapView };
export default MapView;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#E9EEF3' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
