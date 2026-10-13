import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { buildTrackingMapHtml } from '../../../admin-web/live-tracking-map';
import { LocationPoint, lastSeen, trackingStatus } from '../utils/locationUtils';
import { sanitizeAvatarUrl } from '../../lib/avatarUrl';
import PERSON_AVATARS from '../../theme/personAvatars';

/**
 * Вэб: react-native-webview вэб дээр ажилладаггүй тул ижил Leaflet HTML-ийг
 * iframe-д ачаална. HTML нь `parent.postMessage`-ээр хариулдаг (admin-web
 * мөн ингэж ашигладаг). Props нь `TrackingMap.tsx`-тэй ЯГ ИЖИЛ.
 */
const html = buildTrackingMapHtml({ avatars: true });
const AVATAR_LIB = PERSON_AVATARS.map((svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
function avatarIndex(name: string) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR_LIB.length ? h % AVATAR_LIB.length : 0; }
export type TrackingMapHandle = { command: (command: string) => void };
type Props = { employees: LocationPoint[]; points?: LocationPoint[]; selected?: string; follow?: boolean; satellite?: boolean;
  sites?: any[]; now: number; onSelect?: (id: string) => void; onPan?: () => void; interactive?: boolean; meId?: string };

export default memo(forwardRef<TrackingMapHandle, Props>(function TrackingMap({ employees, points, selected, follow, satellite, sites, now, onSelect, onPan, meId, interactive = true }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, onPan });
  handlers.current = { onSelect, onPan };
  function send(data: object) { frame.current?.contentWindow?.postMessage({ trackingUpdate: data }, '*'); }
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.trackingMap) return;
      const data = e.data.trackingMap;
      if (data.type === 'ready') setReady(true);
      if (data.type === 'select') handlers.current.onSelect?.(data.id);
      if (data.type === 'pan') handlers.current.onPan?.();
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);
  useImperativeHandle(ref, () => ({ command: command => send({ command, selected: selected ?? null }) }), [selected]);
  useEffect(() => { if (ready) send({ avatarLib: AVATAR_LIB }); }, [ready]);
  useEffect(() => { if (ready) send({ employees: employees.map(p => ({
    ...p, status: trackingStatus(p, now), lastSeen: lastSeen(p.timestamp, now),
    avatar: sanitizeAvatarUrl(p.avatar_url) || null, av: avatarIndex(String(p.name || p.employee_id)), me: !!meId && p.employee_id === meId,
  })) }); }, [employees, now, ready, meId]);
  useEffect(() => { if (ready) send({ route: points || [], sites: sites || [] }); }, [points, sites, ready]);
  useEffect(() => { if (ready) send({ selected: selected ?? null, follow, satellite }); }, [selected, follow, satellite, ready]);
  return (
    // Нүүрний жижиг карт (interactive=false) өөрийн өндрөө авна.
    <View style={{ flex: 1, minHeight: interactive ? 320 : 0 }} pointerEvents={interactive ? 'auto' : 'none'}>
      {React.createElement('iframe', { ref: frame, srcDoc: html, title: 'Газрын зураг', style: { border: 0, width: '100%', height: '100%', flex: 1 } })}
    </View>
  );
}));
