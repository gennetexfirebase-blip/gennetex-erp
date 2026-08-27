import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, Button, EmptyState, LoadingState, BottomBar } from '../components/ui';
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />

              {/* ── Хүлээн авагч ──────────────────────────────── */}
              <View style={[styles.block, { backgroundColor: colors.surfaceContainer }]}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Хүлээн авагч</Text>

                <View style={styles.audienceRow}>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.audienceChip,
                        {
                          backgroundColor:
                            audienceKind === opt.key ? colors.primary : colors.surfaceContainerHigh,
                        },
                      ]}
                      onPress={() => setAudienceKind(opt.key)}
                    >
                      <Text
                        style={{
                          color: audienceKind === opt.key ? colors.onPrimary : colors.textMuted,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
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
                            {
                              backgroundColor:
                                departmentId === d.id ? colors.primary : colors.surfaceContainerHigh,
                            },
                          ]}
                          onPress={() => setDepartmentId(d.id)}
                        >
                          <Text
                            style={{
                              color: departmentId === d.id ? colors.onPrimary : colors.text,
                              fontSize: 12,
                            }}
                          >
                            {d.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}

                {audienceKind === 'users' ? (
                  <TouchableOpacity
                    style={styles.pickerCircleWrap}
                    onPress={() => setSheetVisible(true)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.pickerCircle, { borderColor: colors.primary }]}>
                      <Ionicons name="add" size={26} color={colors.primary} />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                      {selectedIds.length ? `${selectedIds.length} ажилтан` : 'Хоосон'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* ── Мэдэгдэл ─────────────────────────────────── */}
              <View style={[styles.block, { backgroundColor: colors.surfaceContainer }]}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.md }}>
                  Мэдэгдэл илгээх
                </Text>

                <TextInput
                  style={[styles.titleInput, { borderColor: colors.outlineVariant, color: colors.text }]}
                  placeholder="Гарчиг"
                  placeholderTextColor={colors.textFaint}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                />

                <View style={[styles.bodyWrap, { borderColor: colors.primary }]}>
                  <TextInput
                    style={[styles.bodyInput, { color: colors.text }]}
                    placeholder="Мэдэгдлээ бичнэ үү..."
                    placeholderTextColor={colors.textFaint}
                    value={body}
                    onChangeText={(t) => t.length <= 1000 && setBody(t)}
                    multiline
                  />
                  <Text style={{ color: colors.textFaint, fontSize: 12, alignSelf: 'flex-end' }}>
                    {body.length}/1000
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 },
                  ]}
                  onPress={send}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  <Ionicons name="paper-plane" size={17} color={colors.onPrimary} />
                  <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '700' }}>
                    {sending ? 'Илгээж байна...' : 'Илгээх'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ alignSelf: 'center', paddingVertical: 12 }}
                  onPress={() => setFormVisible(false)}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Болих</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },

  block: { borderRadius: 18, padding: spacing.lg, marginBottom: spacing.md },
  audienceRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  audienceChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },

  pickerCircleWrap: { alignItems: 'center', marginTop: spacing.lg },
  pickerCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  bodyWrap: { borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 130 },
  bodyInput: { flex: 1, fontSize: 15, textAlignVertical: 'top', minHeight: 90 },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 28,
    marginTop: spacing.lg,
  },
});
