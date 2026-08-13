import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';
import { isOnline, formatLastSeen } from '../lib/online';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase() || ' ?';
}

/** Дуудлагад шаардлагатай талбарууд — бүтэн мөрийг дамжуулах шаардлагагүй. */
function peerOf(item, displayName) {
  return { id: item.id, name: displayName, avatar: item.avatar_url || null };
}

export default function EmployeeDirectoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { fetchDirectory, isCloud, currentUser } = useApp();
  const { placeCall } = useCall();
  const [list, setList] = useState([]);

  const load = useCallback(async () => {
    try {
      setList(await fetchDirectory());
    } catch (e) {}
  }, [fetchDirectory]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилтны мэдээлэл"/>
        <EmptyState text="Supabase холболт шаардлагатай."/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажилтны мэдээлэл" subtitle={`${list.length} ажилтан`} />
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const online = isOnline(item.last_seen);
          const displayName = [item.last_name, item.name].filter(Boolean).join(' ') || item.name || '—';
          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{initials(displayName)}</Text>
                  )}
                  <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{displayName}</Text>
                  {item.position ? <Text style={styles.sub}>{item.position}</Text> : null}
                  <Text style={[styles.status, online && styles.statusOn]}>{formatLastSeen(item.last_seen)}</Text>
                  {item.phone ? <Text style={styles.line}>{item.phone}</Text> : null}
                  {item.email ? <Text style={styles.line}>{item.email}</Text> : null}
                  {item.address ? <Text style={styles.line}>{item.address}</Text> : null}
                </View>
              </View>
              {/* Аппаар залгах нь оператороор дамжихгүй, үнэгүй. Утасны
                  дугаараар залгах сонголтыг ч үлдээв — тухайн ажилтан
                  апп нээгээгүй байж болно. */}
              <View style={styles.actions}>
                {item.id !== currentUser?.id ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => placeCall(peerOf(item, displayName), 'audio')}
                      accessibilityRole="button"
                      accessibilityLabel={`${displayName} руу аппаар залгах`}
                    >
                      <Ionicons name="call" size={16} color={colors.onPrimary} />
                      <Text style={styles.actionPrimaryText}>Дуудлага</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => placeCall(peerOf(item, displayName), 'video')}
                      accessibilityRole="button"
                      accessibilityLabel={`${displayName} руу видеогоор залгах`}
                    >
                      <Ionicons name="videocam" size={16} color={colors.onPrimary} />
                      <Text style={styles.actionPrimaryText}>Видео</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {item.phone ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.phone} дугаар руу залгах`}
                  >
                    <Ionicons name="keypad" size={16} color={colors.primary} />
                    <Text style={styles.callText}>Утсаар</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState text="Бүртгэлтэй ажилтан алга." />}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'visible'},
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: '800'},
  dot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.surface },
  name: { color: colors.text, fontSize: 17, fontWeight: '800'},
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  status: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600'},
  statusOn: { color: colors.success },
  line: { color: colors.text, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  callText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
