/**
 * Offline-first soft banner — hard OfflineGate-ийн оронд/хажууд.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  getPendingCount,
  flushQueue,
  subscribeOfflineQueue,
  startOfflineSyncWatcher,
} from '../../services/offlineQueueService';
import { isFlagOn } from '../../lib/featureFlags';
import { darkColors } from '../../theme/tokens';

const c = darkColors;

export default function OfflineSyncBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isFlagOn('offlineFirst')) return;
    startOfflineSyncWatcher();
    const unsubNet = NetInfo.addEventListener((s) => {
      setOnline(!!(s?.isConnected && s?.isInternetReachable !== false));
    });
    NetInfo.fetch().then((s) => setOnline(!!(s?.isConnected && s?.isInternetReachable !== false)));
    getPendingCount().then(setPending);
    const unsubQ = subscribeOfflineQueue((snap) => setPending(snap.pending || 0));
    return () => {
      unsubNet();
      unsubQ();
    };
  }, []);

  if (!isFlagOn('offlineFirst')) return null;
  if (online && pending === 0) return null;

  const sync = async () => {
    setSyncing(true);
    try {
      await flushQueue();
      setPending(await getPendingCount());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[styles.bar, !online && styles.barOff]}>
      <Text style={styles.text}>
        {!online
          ? `Оффлайн горим${pending ? ` · ${pending} хүлээгдэж буй` : ''}`
          : `Синк хүлээгдэж буй: ${pending}`}
      </Text>
      {online && pending > 0 ? (
        <TouchableOpacity onPress={sync} disabled={syncing}>
          <Text style={styles.btn}>{syncing ? '…' : 'Синк'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barOff: { backgroundColor: '#b45309' },
  text: { color: '#fff', fontWeight: '700', fontSize: 12, flex: 1 },
  btn: { color: '#fff', fontWeight: '900', fontSize: 12, marginLeft: 12 },
});
