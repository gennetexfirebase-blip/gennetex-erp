import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { View, Text } from 'react-native';
import { buildTrackingMapHtml } from '../../../admin-web/live-tracking-map';
import { LocationPoint, lastSeen, trackingStatus } from '../utils/locationUtils';
import { sanitizeAvatarUrl } from '../../lib/avatarUrl';
import PERSON_AVATARS from '../../theme/personAvatars';
const html = buildTrackingMapHtml({ avatars: true });
// Зураггүй ажилтанд prototype-ийн зурсан дүрс — нэг удаа илгээгээд индексээр заана.
const AVATAR_LIB = PERSON_AVATARS.map((svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
function avatarIndex(name: string) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR_LIB.length ? h % AVATAR_LIB.length : 0; }
export type TrackingMapHandle = { command: (command: string) => void };
type Props = { employees: LocationPoint[]; points?: LocationPoint[]; selected?: string; follow?: boolean; satellite?: boolean;
  sites?: any[]; now: number; onSelect?: (id: string) => void; onPan?: () => void; interactive?: boolean; meId?: string };
export default memo(forwardRef<TrackingMapHandle, Props>(function TrackingMap({ employees, points, selected, follow, satellite, sites, now, onSelect, onPan, meId, interactive = true }, ref) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  function send(data: object) { web.current?.injectJavaScript(`window.trackingUpdate && window.trackingUpdate(${JSON.stringify(data).replace(/</g, '\\u003c')});true;`); }
  useImperativeHandle(ref, () => ({ command: command => send({ command, selected: selected ?? null }) }), [selected]);
  useEffect(() => { if (ready) send({ avatarLib: AVATAR_LIB }); }, [ready]);
  useEffect(() => { if (ready) send({ employees: employees.map(p => ({
    ...p, status: trackingStatus(p, now), lastSeen: lastSeen(p.timestamp, now),
    avatar: sanitizeAvatarUrl(p.avatar_url) || null, av: avatarIndex(String(p.name || p.employee_id)), me: !!meId && p.employee_id === meId,
  })) }); }, [employees, now, ready, meId]);
  useEffect(() => { if (ready) send({ route: points || [], sites: sites || [] }); }, [points, sites, ready]);
  useEffect(() => { if (ready) send({ selected: selected ?? null, follow, satellite }); }, [selected, follow, satellite, ready]);
  return <View style={{ flex: 1, minHeight: interactive ? 320 : 0 }}><WebView ref={web} source={{ html }} originWhitelist={['about:blank']} applicationNameForUserAgent="GennetexERP/1.3" javaScriptEnabled
    onError={() => setFailed(true)} onMessage={event => { try { const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') setReady(true); if (data.type === 'error') setFailed(true);
      if (data.type === 'select') onSelect?.(data.id); if (data.type === 'pan') onPan?.();
    } catch { setFailed(true); } }} />{failed && <Text style={{ padding: 12, color: '#b91c1c', backgroundColor: '#fff' }}>Газрын зураг ачаалагдсангүй. Холболтоо шалгаад дахин нээнэ үү.</Text>}</View>;
}));
