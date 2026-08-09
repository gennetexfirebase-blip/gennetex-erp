import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { useApp } from '../context/AppContext';
import { navigationRef } from '../lib/navigationRef';
import { supabase } from '../lib/supabase';
import { screenLabel } from '../services/screenPresenceService';

/**
 * Аппын дэлгэцийг шууд live share (pixel frame).
 * Expo Go дээр native module байхгүй тул идэвхгүй (crash-гүй).
 * Development build: npx expo run:android
 */
const INTERVAL_MS = 900;
const MAX_WIDTH = 420;
const QUALITY = 0.28;

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

function loadCaptureRef() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-view-shot');
    return mod.captureRef || mod.default?.captureRef || null;
  } catch (e) {
    return null;
  }
}

export default function ScreenLiveShare({ viewRef }) {
  const { isCloud, currentUser } = useApp();
  const channelRef = useRef(null);
  const busyRef = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Expo Go — native view-shot байхгүй, импорт ч хийхгүй
    if (isExpoGo) return;
    if (!isCloud || !currentUser?.id || !viewRef) return;

    const captureRef = loadCaptureRef();
    if (!captureRef) return;

    const userId = currentUser.id;
    const userName = currentUser.name || 'Ажилтан';
    const channel = supabase.channel(`screen-live-${userId}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    channelRef.current = channel;
    channel.subscribe();

    const sendFrame = async () => {
      if (busyRef.current) return;
      if (appState.current !== 'active') return;
      if (!viewRef.current) return;
      if (!channelRef.current) return;

      busyRef.current = true;
      try {
        const uri = await captureRef(viewRef, {
          format: 'jpg',
          quality: QUALITY,
          width: MAX_WIDTH,
          result: 'base64',
        });
        if (!uri) return;

        let screen = null;
        try {
          if (navigationRef.isReady()) {
            screen = getActiveRouteName(navigationRef.getRootState());
          }
        } catch (e) {}

        await channelRef.current.send({
          type: 'broadcast',
          event: 'frame',
          payload: {
            user_id: userId,
            user_name: userName,
            screen,
            screen_label: screenLabel(screen),
            image: uri,
            at: new Date().toISOString(),
          },
        });
      } catch (e) {
        // capture алдаа — чимээгүй
      } finally {
        busyRef.current = false;
      }
    };

    const timer = setInterval(sendFrame, INTERVAL_MS);
    const first = setTimeout(sendFrame, 800);

    const sub = AppState.addEventListener('change', (s) => {
      appState.current = s;
    });

    return () => {
      clearInterval(timer);
      clearTimeout(first);
      sub.remove();
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
      channelRef.current = null;
    };
  }, [isCloud, currentUser?.id, currentUser?.name, viewRef]);

  return null;
}
