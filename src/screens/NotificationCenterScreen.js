import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { EmptyState } from '../components/ui';
import { spacing } from '../theme';
import { navigateFromNotification } from '../lib/navigationRef';
import * as notificationApi from '../services/notificationCenterService';

/** Төрөл бүрийн дүрс, өнгө, монгол шошго. */
const TYPE_META = {
  message: { emoji: '💬', label: 'Чат', tone: '#2ec5c0' },
  chat: { emoji: '💬', label: 'Чат', tone: '#2ec5c0' },
  order: { emoji: '📦', label: 'Захиалга', tone: '#f5b544' },
  payment: { emoji: '💳', label: 'Төлбөр', tone: '#3fcf8e' },
  task: { emoji: '✅', label: 'Даалгавар', tone: '#3fcf8e' },
  admin: { emoji: '📣', label: 'Систем', tone: '#2f9fe0' },
  system: { emoji: '⚙️', label: 'Систем', tone: '#2f9fe0' },
  urgent: { emoji: '⚠️', label: 'Яаралтай', tone: '#ff6b60' },
  device: { emoji: '📱', label: 'Шинэ', tone: '#9b6dff' },
  attendance_pending: { emoji: '🔔', label: 'Ирц', tone: '#2f9fe0' },
};

function metaFor(type) {
  return TYPE_META[type] || { emoji: '🔔', label: 'Мэдэгдэл', tone: '#2f9fe0' };
}

function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

export default function NotificationCenterScreen() {
  const { currentUser } = useApp();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setRows(await notificationApi.fetchNotifications(currentUser.id));
    } catch (error) {
      Alert.alert('Алдаа', error.message || 'Мэдэгдэл ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
    return notificationApi.subscribeNotifications(currentUser?.id, load);
  }, [load, currentUser?.id]);

  const open = async (row) => {
    try {
      if (!row.is_read) await notificationApi.markNotificationRead(row.id, currentUser.id);
      setRows((items) => items.map((item) => (item.id === row.id ? { ...item, is_read: true } : item)));
      navigateFromNotification({ type: row.type, ...(row.data || {}) });
    } catch (error) {
      Alert.alert('Алдаа', error.message);
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllNotificationsRead(currentUser.id);
      setRows((items) => items.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      Alert.alert('Алдаа', error.message);
    }
  };

  const unread = rows.filter((row) => !row.is_read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Толгой ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Буцах"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.title}>Мэдэгдэл</Text>
          <Text style={styles.subtitle}>
            {unread > 0 ? `${unread} уншаагүй` : 'Бүгд уншсан'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityLabel="Тохиргоо"
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {unread > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAll} activeOpacity={0.75}>
            <Ionicons name="checkmark-done" size={17} color={colors.primary} />
            <Text style={styles.markAllText}>Бүгдийг уншсанд тооцох</Text>
          </TouchableOpacity>
        ) : null}

        {!rows.length && !loading ? (
          <EmptyState text="Одоогоор мэдэгдэл алга." />
        ) : (
          rows.map((row) => {
            const meta = metaFor(row.type);
            return (
              <TouchableOpacity
                key={row.id}
                activeOpacity={0.8}
                onPress={() => open(row)}
                style={[styles.card, !row.is_read && styles.cardUnread]}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.emojiCircle, { backgroundColor: `${meta.tone}1F` }]}>
                    <Text style={styles.emoji}>{meta.emoji}</Text>
                  </View>

                  <View style={styles.content}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {row.title}
                    </Text>
                    {row.body ? (
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {row.body}
                      </Text>
                    ) : null}

                    <View style={styles.metaRow}>
                      <View style={[styles.typeBadge, { borderColor: `${meta.tone}66` }]}>
                        <Text style={[styles.typeBadgeText, { color: meta.tone }]}>{meta.label}</Text>
                      </View>
                      <Text style={styles.dot}>•</Text>
                      <Text style={styles.date}>{fmtDate(row.created_at)}</Text>
                    </View>
                  </View>

                  {!row.is_read ? <View style={styles.unreadDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 1 },

    body: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 130 },

    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 11,
      marginBottom: spacing.md,
    },
    markAllText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    cardUnread: { borderColor: `${colors.primary}44` },
    cardRow: { flexDirection: 'row', gap: spacing.md },

    emojiCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: { fontSize: 24 },

    content: { flex: 1 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 3 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    typeBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },
    dot: { color: colors.textFaint, fontSize: 12 },
    date: { color: colors.textFaint, fontSize: 12 },

    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
  });
