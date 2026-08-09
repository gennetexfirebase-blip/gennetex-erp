import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Button, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as chatApi from '../services/chatService';
import { isOnline, formatLastSeen } from '../lib/online';

export default function AddGroupMembersScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, title } = route.params || {};
  const { currentUser, fetchEmployees } = useApp();
  const [employees, setEmployees] = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [emps, mems] = await Promise.all([
        fetchEmployees(),
        chatApi.fetchConversationMembers(conversationId),
      ]);
      const memberIds = new Set(mems.map((m) => m.user_id));
      setMembers(mems);
      setEmployees(emps.filter((e) => e.id !== currentUser?.id && !memberIds.has(e.id)));
    } catch (e) {}
  }, [conversationId, currentUser?.id, fetchEmployees]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const handleAdd = async () => {
    const picked = employees.filter((e) => selected[e.id]);
    if (!picked.length) {
      Alert.alert('Анхаар', 'Нэмэх ажилтан сонгоно уу.');
      return;
    }
    setSaving(true);
    try {
      await chatApi.addGroupMembers(
        conversationId,
        picked.map((e) => ({ id: e.id, name: e.name }))
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Гишүүн нэмэх" subtitle={title || ''} />
      <FlatList
        data={employees}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        ListHeaderComponent={
          <Text style={styles.hint}>Одоогийн гишүүд: {members.map((m) => m.user_name).join(', ') || '—'}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, selected[item.id] && styles.rowOn]} onPress={() => toggle(item.id)}>
            <View style={styles.avatar}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(item.name || ' ?').charAt(0)}</Text>
              )}
              <View style={[styles.dot, { backgroundColor: isOnline(item.last_seen) ? colors.success : colors.textMuted }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{formatLastSeen(item.last_seen)}</Text>
            </View>
            <Text style={styles.check}>{selected[item.id] ? '' : ''}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState text="Нэмэх ажилтан алга." />}
      />
      <View style={styles.footer}>
        <Button title={saving ? '...' : 'Нэмэх'} onPress={handleAdd} disabled={saving} />
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'visible'},
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: colors.primary, fontWeight: '800'},
  dot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  check: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
