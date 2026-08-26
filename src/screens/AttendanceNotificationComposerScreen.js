import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Modal, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, Field, Button, EmptyState, LoadingState, BottomBar } from '../components/ui';
import EmployeeSelectSheet from '../components/EmployeeSelectSheet';
import { useApp } from '../context/AppContext';
import * as campaignApi from '../services/notificationCampaignService';
import * as deptApi from '../services/departmentService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

const AUDIENCE_OPTIONS = [
  { key: 'all', label: 'Бүх ажилтан' },
  { key: 'department', label: 'Алба хэлтэс' },
  { key: 'users', label: 'Сонгосон ажилтан' },
];

export default function AttendanceNotificationComposerScreen() {
  const { currentUser, fetchEmployees } = useApp();
  const profile = currentUser;

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceKind, setAudienceKind] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setCampaigns(await campaignApi.fetchNotificationCampaigns());
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    deptApi.fetchDepartments().then(setDepartments).catch(() => {});
    fetchEmployees().then(setEmployees).catch(() => {});
  }, [load]);

  const openForm = () => {
    setTitle('');
    setBody('');
    setAudienceKind('all');
    setDepartmentId(null);
    setSelectedIds([]);
    setFormVisible(true);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Дутуу мэдээлэл', 'Гарчиг болон мэдэгдлийн бичвэрийг бөглөнө үү.');
      return;
    }
    let audience = { kind: audienceKind };
    if (audienceKind === 'department') {
      if (!departmentId) {
        Alert.alert('Алба хэлтэс сонгоно уу');
        return;
      }
      const memberIds = employees.filter((e) => e.department_id === departmentId && e.user_id).map((e) => e.user_id);
      audience = { kind: 'department', departmentId, userIds: memberIds };
    } else if (audienceKind === 'users') {
      if (!selectedIds.length) {
        Alert.alert('Ажилтан сонгоно уу');
        return;
      }
      audience = { kind: 'users', userIds: selectedIds };
    }

    setSending(true);
    try {
      await campaignApi.sendNotificationCampaign({
        title: title.trim(),
        body: body.trim(),
        audience,
        sentBy: profile?.id,
        sentByName: profile?.name,
      });
      setFormVisible(false);
      await load();
      Alert.alert('Илгээгдлээ', 'Мэдэгдэл амжилттай илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Илгээсэн мэдэгдэл" />
      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={<EmptyState text="Хоосон" />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 6 }}>
                {new Date(item.created_at).toLocaleString('mn-MN')} · {item.recipient_count} хүлээн авагч
              </Text>
            </View>
          )}
        />
      )}

      <BottomBar>
        <Button title="Мэдэгдэл илгээх" onPress={openForm} />
      </BottomBar>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md }}>
                Мэдэгдэл илгээх
              </Text>
              <Field label="Гарчиг" value={title} onChangeText={setTitle} />
              <Field
                label="Мэдэгдэл"
                value={body}
                onChangeText={setBody}
                multiline
                style={{ marginTop: spacing.md, minHeight: 90, textAlignVertical: 'top' }}
              />

              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: 8 }}>
                Хүлээн авагч
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {AUDIENCE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.audienceChip,
                      { backgroundColor: audienceKind === opt.key ? colors.primary : colors.surfaceContainerHigh },
                    ]}
                    onPress={() => setAudienceKind(opt.key)}
                  >
                    <Text style={{ color: audienceKind === opt.key ? colors.onPrimary : colors.text, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {audienceKind === 'department' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {departments.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[
                          styles.audienceChip,
                          { backgroundColor: departmentId === d.id ? colors.primary : colors.surfaceContainerHigh },
                        ]}
                        onPress={() => setDepartmentId(d.id)}
                      >
                        <Text style={{ color: departmentId === d.id ? colors.onPrimary : colors.text, fontSize: 12 }}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : null}

              {audienceKind === 'users' ? (
                <TouchableOpacity
                  style={[styles.assignBtn, { borderColor: colors.outlineVariant, marginTop: spacing.md }]}
                  onPress={() => setSheetVisible(true)}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    Ажилтан сонгох{selectedIds.length ? ` (${selectedIds.length})` : ''}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.xl }}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setFormVisible(false)} />
                <Button title="Мэдэгдэл илгээх" style={{ flex: 1 }} onPress={send} loading={sending} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <EmployeeSelectSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        employees={employees}
        colors={colors}
        initialSelected={selectedIds}
        onConfirm={(ids) => {
          setSelectedIds(ids);
          setSheetVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: spacing.lg, marginBottom: spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '88%' },
  audienceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  assignBtn: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
