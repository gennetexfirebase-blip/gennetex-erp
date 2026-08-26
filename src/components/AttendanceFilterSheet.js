import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

const STATUS_OPTIONS = [
  { key: 'all', label: 'Бүгд' },
  { key: 'on_time', label: 'Ирсэн' },
  { key: 'late', label: 'Хоцорсон' },
  { key: 'absent', label: 'Тасалсан' },
  { key: 'early_leave', label: 'Эрт явсан' },
  { key: 'leave', label: 'Чөлөөтэй' },
];

/** Admin dashboard-ийн Filter icon дарахад нээгдэх bottom sheet. */
export default function AttendanceFilterSheet({
  visible,
  onClose,
  onApply,
  departments = [],
  locations = [],
  colors,
  initial = {},
}) {
  const [departmentId, setDepartmentId] = useState(initial.departmentId || null);
  const [status, setStatus] = useState(initial.status || 'all');
  const [locationId, setLocationId] = useState(initial.locationId || null);
  const [employeeQuery, setEmployeeQuery] = useState(initial.employeeQuery || '');

  useEffect(() => {
    if (visible) {
      setDepartmentId(initial.departmentId || null);
      setStatus(initial.status || 'all');
      setLocationId(initial.locationId || null);
      setEmployeeQuery(initial.employeeQuery || '');
    }
  }, [visible]);

  const clear = () => {
    setDepartmentId(null);
    setStatus('all');
    setLocationId(null);
    setEmployeeQuery('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: colors.textMuted }]}>Алба хэлтэс</Text>
            <View style={styles.chipRow}>
              <Chip label="Бүгд" active={!departmentId} onPress={() => setDepartmentId(null)} colors={colors} />
              {departments.map((d) => (
                <Chip
                  key={d.id}
                  label={d.name}
                  active={departmentId === d.id}
                  onPress={() => setDepartmentId(d.id)}
                  colors={colors}
                />
              ))}
            </View>

            <Text style={[styles.section, { color: colors.textMuted }]}>Ирцийн төлөв</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={status === s.key}
                  onPress={() => setStatus(s.key)}
                  colors={colors}
                />
              ))}
            </View>

            <Text style={[styles.section, { color: colors.textMuted }]}>Ажилтан</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.outlineVariant, color: colors.text }]}
              placeholder="Ажилтны нэрээр хайх"
              placeholderTextColor={colors.textFaint}
              value={employeeQuery}
              onChangeText={setEmployeeQuery}
            />

            <Text style={[styles.section, { color: colors.textMuted }]}>Байршил</Text>
            <View style={styles.chipRow}>
              <Chip label="Бүгд" active={!locationId} onPress={() => setLocationId(null)} colors={colors} />
              {locations.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  active={locationId === l.id}
                  onPress={() => setLocationId(l.id)}
                  colors={colors}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, { borderColor: colors.danger }]} onPress={clear}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Цэвэрлэх</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => onApply({ departmentId, status, locationId, employeeQuery })}
            >
              <Text style={{ color: colors.onPrimary || '#fff', fontWeight: '700' }}>Харах</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress, colors }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surfaceContainer },
      ]}
      onPress={onPress}
    >
      <Text style={{ color: active ? colors.onPrimary || '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '80%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  section: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});
