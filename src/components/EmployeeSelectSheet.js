import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import ChatAvatar from './ChatAvatar';

/**
 * "Ажилтан сонгох" bottom sheet — Wi-Fi/Байршил/Мэдэгдэл илгээх зэрэгт
 * дахин ашиглана. Зөвхөн БҮРТГЭЛТЭЙ (user_id-тэй) ажилтныг сонгоно —
 * урьдчилан зөвшөөрөгдсөн ч нэвтэрч амжаагүй хүнийг оноож болохгүй, учир
 * нь assign хийх хүснэгтүүд auth.users(id)-г шаарддаг.
 */
export default function EmployeeSelectSheet({
  visible,
  onClose,
  onConfirm,
  employees = [],
  departments = [],
  initialSelected = [],
  colors,
  title = 'Ажилтан сонгох',
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('employee'); // 'employee' | 'department'
  const [selected, setSelected] = useState(new Set(initialSelected));

  const registered = useMemo(() => employees.filter((e) => e.user_id), [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registered;
    return registered.filter(
      (e) =>
        String(e.name || '').toLowerCase().includes(q) ||
        String(e.phone || '').toLowerCase().includes(q)
    );
  }, [registered, query]);

  const toggle = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((e) => e.user_id)));
  const clear = () => setSelected(new Set());

  const addDepartment = (dept) => {
    const memberIds = registered.filter((e) => e.department_id === dept.id).map((e) => e.user_id);
    setSelected((prev) => new Set([...prev, ...memberIds]));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border || colors.outlineVariant }]} />
          <TextInput
            style={[styles.search, { borderColor: colors.border || colors.outlineVariant, color: colors.text }]}
            placeholder="Ажилтны нэр, утасны дугаар эсвэл ал..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <View style={styles.tabRow}>
            <TouchableOpacity onPress={() => setTab('employee')}>
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'employee' ? colors.primary : colors.textMuted },
                  tab === 'employee' && styles.tabTextActive,
                ]}
              >
                Ажилтан
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('department')}>
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'department' ? colors.primary : colors.textMuted },
                  tab === 'department' && styles.tabTextActive,
                ]}
              >
                Алба хэлтэс
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'employee' ? (
            <>
              <View style={styles.headerRow}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Нийт ажилчид</Text>
                <TouchableOpacity onPress={selectAll}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Бүгдийг сонгох</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.user_id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const checked = selected.has(item.user_id);
                  return (
                    <TouchableOpacity style={styles.row} onPress={() => toggle(item.user_id)} activeOpacity={0.7}>
                      <ChatAvatar name={item.name} uri={item.avatar_url} size={36} />
                      <Text style={{ color: colors.text, fontSize: 14, flex: 1, marginLeft: 10 }}>{item.name}</Text>
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: colors.border || colors.outlineVariant },
                          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        {checked ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          ) : (
            <FlatList
              data={departments}
              keyExtractor={(d) => d.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => addDepartment(item)} activeOpacity={0.7}>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{item.name}</Text>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Нэмэх</Text>
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, { borderColor: colors.danger }]} onPress={clear}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Цэвэрлэх</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => onConfirm(Array.from(selected))}
            >
              <Text style={{ color: colors.onPrimary || '#fff', fontWeight: '700' }}>
                Сонгох{selected.size ? ` (${selected.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 24, marginBottom: 10 },
  tabText: { fontSize: 14, fontWeight: '600', paddingBottom: 6 },
  tabTextActive: { borderBottomWidth: 2, borderBottomColor: 'currentColor' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});
