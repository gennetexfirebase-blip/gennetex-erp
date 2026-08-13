import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useCall } from '../context/CallContext';
import * as voip from '../services/voipCallService';
import { formatChatDay, formatTime } from '../lib/formatTime';
import { accent } from '../theme/accents';

/**
 * Дуудлагын түүх.
 *
 * `call_history` RPC нь зөвхөн миний оролцсон дуудлагыг буцаана — RLS
 * дээр нэмээд функц дотор ч шүүнэ. Хэн ч бусдын түүхийг харахгүй.
 */

function iconFor(row, isDark) {
  if (row.status === 'missed' || row.status === 'unreachable') {
    return { name: 'call', color: accent('rose', isDark), rotate: '135deg' };
  }
  if (row.direction === 'outgoing') {
    return { name: 'arrow-up-outline', color: accent('green', isDark) };
  }
  return { name: 'arrow-down-outline', color: accent('brand', isDark) };
}

function Row({ item, onCall }) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const icon = iconFor(item, isDark);
  const missed = item.status === 'missed' || item.status === 'unreachable';
  const when = new Date(item.created_at);

  return (
    <View style={styles.row}>
      {item.other_avatar ? (
        <Image source={{ uri: item.other_avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons name="person" size={22} color={colors.textFaint} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.name, missed && { color: accent('rose', isDark) }]} numberOfLines={1}>
          {item.other_name || 'Ажилтан'}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons
            name={icon.name}
            size={14}
            color={icon.color}
            style={icon.rotate ? { transform: [{ rotate: icon.rotate }] } : null}
          />
          <Text style={styles.meta} numberOfLines={1}>
            {voip.historyLabel(item)} · {formatChatDay(when)} {formatTime(when)}
          </Text>
          {item.type === 'video' ? (
            <Ionicons name="videocam" size={14} color={colors.textFaint} />
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => onCall(item, item.type === 'video' ? 'video' : 'audio')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${item.other_name || 'Ажилтан'} руу залгах`}
      >
        <Ionicons
          name={item.type === 'video' ? 'videocam' : 'call'}
          size={20}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function CallHistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud } = useApp();
  const { placeCall } = useCall();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setRows(await voip.fetchHistory(150));
    } catch (e) {
      setError(e.message || 'Түүх ачаалахад алдаа гарлаа.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCloud]);

  useEffect(() => {
    load();
  }, [load]);

  const onCall = (item, type) =>
    placeCall({ id: item.other_id, name: item.other_name, avatar: item.other_avatar }, type);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Row item={item} onCall={onCall} />}
        contentContainerStyle={rows.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="call-outline" size={44} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Дуудлагын түүх хоосон</Text>
            <Text style={styles.emptyText}>
              Чат дотроос ажилтан руу залгаж эхлээрэй.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    list: { paddingVertical: 6 },
    emptyWrap: { flexGrow: 1 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 11,
      gap: 12,
    },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceDim },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },

    body: { flex: 1 },
    name: { color: colors.text, fontSize: 16, fontWeight: '600' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    meta: { color: colors.textFaint, fontSize: 13, flexShrink: 1 },

    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceDim,
    },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
    emptyText: { color: colors.textFaint, fontSize: 14, textAlign: 'center' },

    error: {
      color: '#fff',
      backgroundColor: colors.errorColor,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 13,
    },
  });
