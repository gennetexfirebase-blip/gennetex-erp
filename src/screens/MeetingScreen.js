import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import * as meetingApi from '../services/meetingService';
import MeetingModal from '../components/MeetingModal';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export default function MeetingScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, isAdmin, isCloud } = useApp();
  const me = currentUser;

  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const m = await meetingApi.fetchActiveMeeting(meetingApi.KIND_MEETING);
      // Live stream хуралд орохгүй
      setActive(m?.kind === meetingApi.KIND_MEETING ? m : null);
    } catch (e) {
      setActive(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCloud]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!isCloud) return;
      const unsub = meetingApi.subscribeMeetings(load);
      // Realtime ирэхгүй байсан ч ажилтан харна
      const poll = setInterval(load, 4000);
      return () => {
        unsub?.();
        clearInterval(poll);
      };
    }, [load, isCloud])
  );

  useEffect(() => {
    const id = route.params?.openMeetingId;
    if (!id || !me?.id) return;
    // Live push-аар ирсэн бол нээхгүй
    const kind = route.params?.openMeetingKind;
    if (kind && kind !== meetingApi.KIND_MEETING) {
      navigation.setParams({
        openMeetingId: undefined,
        openMeetingHost: undefined,
        openMeetingHostId: undefined,
        openMeetingKind: undefined,
      });
      return;
    }
    setActive((prev) =>
      prev?.id === id
        ? prev
        : {
            id,
            host_id: route.params?.openMeetingHostId,
            host_name: route.params?.openMeetingHost || 'Админ',
            kind: meetingApi.KIND_MEETING,
            status: 'active',
          }
    );
    setIsHost(route.params?.openMeetingHostId === me.id);
    setOpen(true);
    navigation.setParams({
      openMeetingId: undefined,
      openMeetingHost: undefined,
      openMeetingHostId: undefined,
      openMeetingKind: undefined,
    });
  }, [route.params?.openMeetingId, me?.id, navigation]);

  const startMeeting = async () => {
    if (!me?.id) return;
    if (active?.id) {
      Alert.alert('Хурал', 'Одоо хурал явагдаж байна. Эхлээд орно уу.', [
        { text: 'Орох', onPress: joinMeeting },
        { text: 'Болих', style: 'cancel' },
      ]);
      return;
    }
    setStarting(true);
    try {
      const m = await meetingApi.startMeeting({
        hostId: me.id,
        hostName: me.name,
        title: 'Админ хурал',
        kind: meetingApi.KIND_MEETING,
      });
      setActive(m);
      setIsHost(true);
      setOpen(true);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setStarting(false);
    }
  };

  const joinMeeting = () => {
    if (!active?.id) return;
    setIsHost(active.host_id === me?.id);
    setOpen(true);
  };

  const closeSession = async () => {
    const wasHost = isHost;
    const id = active?.id;
    setOpen(false);
    setIsHost(false);
    if (wasHost && id) {
      try {
        await meetingApi.endMeeting(id, me?.id);
      } catch (e) {}
    }
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Хурал</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Админ хурал</Text>
          <Text style={styles.heroSub}>
            Админ хурал эхлүүлж дэлгэц/камер share хийнэ. Ажилтан эндээс орно.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : active?.id ? (
          <View style={styles.card}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>ИДЭВХТЭЙ</Text>
            </View>
            <Text style={styles.cardTitle}>{active.host_name || 'Админ'} хурал эхлүүллээ</Text>
            <Text style={styles.cardSub}>{active.title || 'Админ хурал'}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={joinMeeting} activeOpacity={0.88}>
              <Ionicons name="videocam" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {active.host_id === me?.id ? 'Үргэлжлүүлэх' : 'Хуралд орох'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Одоо хурал алга</Text>
            <Text style={styles.cardSub}>
              {isAdmin
                ? 'Хурал эхлүүлээд бүх ажилтныг холбоно уу.'
                : 'Админ хурал эхлүүлсний дараа эндээс орно.'}
            </Text>
            {isAdmin ? (
              <TouchableOpacity
                style={[styles.primaryBtn, starting && { opacity: 0.6 }]}
                onPress={startMeeting}
                disabled={starting}
                activeOpacity={0.88}
              >
                {starting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="videocam" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Хурал эхлүүлэх</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      <MeetingModal
        visible={open && !!active?.id}
        meetingId={active?.id}
        name={me?.name}
        isHost={isHost}
        hostName={active?.host_name}
        mode="meeting"
        onClose={closeSession}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  body: { padding: spacing.lg, gap: spacing.lg },
  hero: {
    backgroundColor: '#0F766E',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  livePillText: { color: '#B91C1C', fontWeight: '900', fontSize: 11 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardSub: { marginTop: 6, color: colors.textMuted, lineHeight: 20 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: colors.onPrimaryContainer, fontWeight: '800', fontSize: 15 },
});
