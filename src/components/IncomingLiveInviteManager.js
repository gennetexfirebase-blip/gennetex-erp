import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useApp } from '../context/AppContext';
import * as liveApi from '../services/liveInviteService';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../services/callAlertService';
import { navigationRef } from '../lib/navigationRef';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/**
 * Live урилга — түгжээтэй утсанд ч ringtone дуугарна.
 * Текст: "таныг {нэр} live-д урьж байна"
 */
export default function IncomingLiveInviteManager() {
  const styles = useStyles(makeStyles);
  const { isCloud, currentUser } = useApp();
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;

    const ringInvite = async (row) => {
      const fresh = Date.now() - new Date(row.created_at).getTime() < 120000;
      if (!fresh || row.status !== 'pending') return;
      setInvite(row);
      const host = row.host_name || 'Ажилтан';
      await startIncomingCallAlert(host, {
        phrase: `таныг ${host} live-д урьж байна`,
      });
    };

    // Апп нээгдэхэд pending урилга шалгах (түгжээтэй үед push ирсэн байж болно)
    (async () => {
      try {
        const { data } = await supabase
          .from('live_invites')
          .select('*')
          .eq('invitee_id', currentUser.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) await ringInvite(data);
      } catch (e) {}
    })();

    const unsub = liveApi.subscribeLiveInvites(currentUser.id, ringInvite);
    return () => {
      unsub();
      stopIncomingCallAlert();
    };
  }, [isCloud, currentUser?.id]);

  useEffect(() => {
    if (!invite) stopIncomingCallAlert();
  }, [invite]);

  const accept = async () => {
    if (!invite) return;
    await stopIncomingCallAlert();
    try {
      await liveApi.respondLiveInvite(invite.id, 'accepted');
    } catch (e) {}
    const liveId = invite.live_id;
    const hostName = invite.host_name;
    const hostId = invite.host_id;
    setInvite(null);
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', {
        screen: 'Feed',
        params: {
          openLiveId: liveId,
          openLiveHost: hostName,
          openLiveHostId: hostId,
        },
      });
    }
  };

  const decline = async () => {
    if (!invite) return;
    await stopIncomingCallAlert();
    try {
      await liveApi.respondLiveInvite(invite.id, 'declined');
    } catch (e) {}
    setInvite(null);
  };

  const host = invite?.host_name || 'Ажилтан';

  return (
    <Modal visible={!!invite} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.livePill}>
            <View style={styles.dot} />
            <Text style={styles.livePillText}>LIVE УРИЛГА</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{host.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.caller}>{host}</Text>
          <Text style={styles.sub}>таныг {host} live-д урьж байна</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.decline]} onPress={decline}>
              <Text style={styles.btnText}>Татгалзах</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.accept]} onPress={accept}>
              <Text style={styles.btnText}>Орох</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000dd',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  livePillText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarText: { color: '#B91C1C', fontSize: 40, fontWeight: '900' },
  caller: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    minWidth: 120,
  },
  accept: { backgroundColor: colors.success },
  decline: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontWeight: '800' },
});
