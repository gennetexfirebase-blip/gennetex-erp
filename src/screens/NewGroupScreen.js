import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Field, Button, EmptyState } from '../components/ui';
import * as chatApi from '../services/chatService';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

export default function NewGroupScreen() {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { currentUser, fetchEmployees } = useApp();
  const me = currentUser;
  const [name, setName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEmployees()
      .then((emps) => setEmployees(emps.filter((e) => e.id !== me?.id)))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const create = async () => {
    const members = employees.filter((e) => selected[e.id]).map((e) => ({ id: e.id, name: e.name }));
    if (!name.trim()) {
      setError('Группын нэр оруулна уу.');
      return;
    }
    if (members.length === 0) {
      setError('Дор хаяж нэг гишүүн сонгоно уу.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const conv = await chatApi.createGroup({ id: me.id, name: me.name }, name.trim(), members);
      navigation.replace('Conversation', {
        conversationId: conv.id,
        title: name.trim(),
        isGroup: true,
      });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const count = Object.values(selected).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Групп үүсгэх" subtitle={`${count} гишүүн сонгосон`} />
      <View style={{ padding: spacing.lg }}>
        <Field label="Группын нэр" placeholder="Ж: Монтажийн баг" value={name} onChangeText={setName} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <FlatList
        data={employees}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const on = !!selected[item.id];
          return (
            <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)} activeOpacity={0.8}>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.checkMark}></Text> : null}
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name || ' ?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || 'Ажилтан'}</Text>
                <Text style={styles.sub}>{item.position || item.email}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState text="Ажилтан алга." />}
      />
      <View style={styles.footer}>
        <Button title={saving ? '...' : 'Групп үүсгэх'} onPress={create} disabled={saving} />
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  error: { color: colors.danger, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 14 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 17, fontWeight: '800'},
  name: { color: colors.text, fontSize: 15, fontWeight: '700'},
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
