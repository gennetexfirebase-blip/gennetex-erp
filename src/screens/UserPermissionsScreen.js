/**
 * Хэрэглэгчийн нарийвчилсан эрх — ЗӨВХӨН ХӨГЖҮҮЛЭГЧ.
 *
 * "Хөгжүүлэгч бусдын яг юу хийх, юу хийж болохгүйг сонгоно" гэсэн
 * шаардлагын дэлгэц. Эрхийн ТҮВШИН (Ажилтан / Ахлах / Админ) нь
 * анхны утгыг өгнө, энд түүнийг хүн тус бүр дээр дарж бичнэ.
 *
 * Хадгалалт: `profiles.permissions` jsonb. Тэр багана нь багана
 * түвшинд хаалттай тул `admin_set_user_permissions` RPC-ээр бичнэ —
 * хэрэглэгч өөртөө эрх нэмэх боломжгүй.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Badge, ScreenHeader, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { roleLabel, isSuperAdmin, ROLES, normalizeRole } from '../lib/roles';
import {
  PERMISSIONS,
  hasPermission,
  permissionSource,
  togglePermission,
  resetPermissions,
} from '../lib/permissions';
import * as authApi from '../services/authService';

export default function UserPermissionsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { authProfile } = useApp();

  const target = route.params?.user || null;
  const [permissions, setPermissions] = useState(() => target?.permissions || {});
  const [saving, setSaving] = useState(false);

  // Одоогийн төлөвийг тооцоход зөвхөн эрх + override хэрэгтэй.
  const draft = useMemo(
    () => ({ ...(target || {}), permissions }),
    [target, permissions]
  );

  const mayEdit = isSuperAdmin(authProfile?.role);
  const targetIsSuperAdmin = normalizeRole(target?.role) === ROLES.SUPERADMIN;

  if (!mayEdit) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Эрхийн тохиргоо" back />
        <EmptyState text="Энэ хэсэг зөвхөн Хөгжүүлэгчид нээлттэй." />
      </View>
    );
  }

  if (!target?.id || target.pending) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Эрхийн тохиргоо" back />
        <EmptyState text="Хэрэглэгч Google-ээр нэвтэрсний дараа эрхийг нь тохируулна." />
      </View>
    );
  }

  const onToggle = (key, value) => {
    setPermissions((prev) => togglePermission({ ...draft, permissions: prev }, key, value));
  };

  const save = async () => {
    setSaving(true);
    try {
      await authApi.adminSetUserPermissions(target.id, permissions);
      Alert.alert('Хадгаллаа', 'Эрхийн тохиргоо шинэчлэгдлээ.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Хадгалж чадсангүй', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    Alert.alert(
      'Түвшинд буцаах',
      'Бүх тусгай тохиргоог цуцалж, эрхийн түвшний анхны утгад буцаах уу?',
      [
        { text: 'Болих', style: 'cancel' },
        { text: 'Буцаах', onPress: () => setPermissions(resetPermissions()) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Эрхийн тохиргоо"
        subtitle={target.name || target.email}
        back
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
        <Card style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{target.name || '—'}</Text>
            <Text style={styles.sub}>{target.email}</Text>
            {target.department_name ? (
              <Text style={styles.dept}>Хэлтэс: {target.department_name}</Text>
            ) : (
              <Text style={styles.dept}>Хэлтэс: харьяалалгүй</Text>
            )}
          </View>
          <Badge text={roleLabel(target.role)} color={colors.accent} />
        </Card>

        {targetIsSuperAdmin ? (
          <Text style={styles.warn}>
            Хөгжүүлэгчийн эрхийг хязгаарлах боломжгүй — өөрийгөө системээс түгжихээс
            сэргийлж, бүх эрх нээлттэй байна.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Асаах/унтраах нь эрхийн ТҮВШНИЙГ дарж бичнэ. Түвшний утгатай ижил
            болгож тохируулбал тусгай тохиргоо арилж, дараа нь түвшин өөрчлөгдөхөд
            автоматаар дагана.
          </Text>
        )}

        {PERMISSIONS.map((perm) => {
          const on = hasPermission(draft, perm.key);
          const source = permissionSource(draft, perm.key);
          return (
            <Card key={perm.key} style={styles.permRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.permLabel}>{perm.label}</Text>
                <Text style={styles.permDesc}>{perm.desc}</Text>
                <Text
                  style={[
                    styles.permSource,
                    source === 'override' && { color: colors.warning },
                  ]}
                >
                  {source === 'superadmin'
                    ? 'Хөгжүүлэгч — үргэлж нээлттэй'
                    : source === 'override'
                      ? 'Тусгайлан тохируулсан'
                      : `${roleLabel(target.role)} түвшнээс`}
                </Text>
              </View>
              <Switch
                value={on}
                onValueChange={(v) => onToggle(perm.key, v)}
                disabled={targetIsSuperAdmin || saving}
                trackColor={{ true: colors.primary, false: colors.outlineVariant }}
                thumbColor={colors.surface}
              />
            </Card>
          );
        })}

        {!targetIsSuperAdmin ? (
          <>
            <Button
              title="Хадгалах"
              style={{ marginTop: spacing.lg }}
              onPress={save}
              loading={saving}
              disabled={saving}
            />
            <Button
              title="Түвшний анхны утгад буцаах"
              variant="ghost"
              style={{ marginTop: spacing.sm }}
              onPress={resetAll}
              disabled={saving}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dept: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  warn: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  permLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  permDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  permSource: { color: colors.textFaint, fontSize: 11, marginTop: 4, fontWeight: '600' },
});
