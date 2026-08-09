import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { navigationRef } from '../lib/navigationRef';
import * as activityApi from '../services/activityLogService';
import * as presenceApi from '../services/screenPresenceService';

function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

/** Навигаци солигдох бүрт лог + админд ephemeral presence (DB-д share хадгалахгүй) */
export default function ActivityLogger() {
  const { isCloud, currentUser } = useApp();
  const lastScreen = useRef(null);

  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;

    presenceApi.startScreenPresence(currentUser.id, currentUser.name);

    const logScreen = (name) => {
      if (!name || name === lastScreen.current) return;
      lastScreen.current = name;
      const detail = `${presenceApi.screenLabel(name)} дэлгэц нээгдлээ`;
      // Нийт лог (өмнөх шиг)
      activityApi.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'screen',
        screen: name,
        detail,
      });
      // Админ live харах — зөвхөн presence, DB биш, мэдэгдэлгүй
      presenceApi.publishScreenPresence({ screen: name, detail });
    };

    const unsub = navigationRef.addListener('state', () => {
      try {
        const state = navigationRef.getRootState();
        logScreen(getActiveRouteName(state));
      } catch (e) {}
    });

    try {
      if (navigationRef.isReady()) {
        logScreen(getActiveRouteName(navigationRef.getRootState()));
      }
    } catch (e) {}

    return () => {
      unsub?.();
      presenceApi.stopScreenPresence();
    };
  }, [isCloud, currentUser?.id, currentUser?.name]);

  return null;
}
