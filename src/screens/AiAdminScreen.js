import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NavIcon from '../components/NavIcon';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import {
  gatherAdminSnapshot,
  askAiAdmin,
  exportSnapshotExcel,
  exportTasksExcel,
} from '../services/aiAdminService';

const QUICK_ACTIONS = [
  { label: 'Өнөөдрийн тойм', prompt: 'Өнөөдрийн нөхцөл байдлын товч тоймыг гаргаж өг.' },
  { label: 'SLA хэтэрсэн', prompt: 'SLA хэтэрсэн дуудлагууд болон хариуцсан инженерүүдийг жагсааж, юу хийхийг зөвлө.' },
  { label: 'Гүйцэтгэлийн дүн', prompt: 'Инженерүүдийн гүйцэтгэлийг харьцуулж, хамгийн сайн ба анхаарах шаардлагатай хүмүүсийг дүгнэ.' },
  { label: 'Ажил хуваарилах', prompt: 'Идэвхтэй болон SLA хэтэрсэн дуудлагуудыг харгалзан ажлыг тэнцвэртэй дахин хуваарилах саналыг ажил бүрт SLA-тайгаар гаргаж өг.' },
];

let msgId = 0;
const nextId = () => `m${Date.now()}_${msgId++}`;

export default function AiAdminScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const scrollRef = useRef(null);

  const [snapshot, setSnapshot] = useState(null);
  const [loadingSnap, setLoadingSnap] = useState(true);
  const [messages, setMessages] = useState([
    {
      id: nextId(),
      role: 'assistant',
      content:
        'Сайн байна уу! Би таны AI Админ туслах. Бүх ажилтны дуудлага, SLA, ирцийг хянаж, ажил хуваарилах, Excel тайлан гаргахад тусална. Асуулт асууж эсвэл доорх товчийг ашиглаарай.',
      tasks: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadSnapshot = useCallback(async () => {
    setLoadingSnap(true);
    try {
      const s = await gatherAdminSnapshot();
      setSnapshot(s);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Мэдээлэл ачаалж чадсангүй');
    } finally {
      setLoadingSnap(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const send = async (text) => {
    const q = String(text ?? input).trim();
    if (!q || sending) return;
    setInput('');
    const userMsg = { id: nextId(), role: 'user', content: q, tasks: [] };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    scrollEnd();
    try {
      const res = await askAiAdmin(q, snapshot, history);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: res.answer, tasks: res.tasks || [] },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: `Алдаа: ${e.message || 'AI хариу өгсөнгүй'}`, tasks: [] },
      ]);
    } finally {
      setSending(false);
      scrollEnd();
    }
  };

  const doExportSnapshot = async () => {
    if (!snapshot || exporting) return;
    setExporting(true);
    try {
      await exportSnapshotExcel(snapshot);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Excel гаргаж чадсангүй');
    } finally {
      setExporting(false);
    }
  };

  const doExportTasks = async (tasks) => {
    try {
      await exportTasksExcel(tasks);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Excel гаргаж чадсангүй');
    }
  };

  const c = snapshot?.counts;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerBadge}>
            <NavIcon name="ai" size={16} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>AI Админ туслах</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={loadSnapshot}>
          <Text style={styles.headerRefresh}>⟳</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.statRow}>
        <Stat styles={styles} value={loadingSnap ? '…' : c?.employees ?? 0} label="Ажилтан" color={colors.primary} />
        <Stat styles={styles} value={loadingSnap ? '…' : c?.todayCheckins ?? 0} label="Ирсэн" color={colors.success} />
        <Stat styles={styles} value={loadingSnap ? '…' : c?.overdue ?? 0} label="SLA хэтэрсэн" color={colors.danger} />
        <Stat styles={styles} value={loadingSnap ? '…' : c?.pending ?? 0} label="Идэвхтэй" color={colors.warning} />
      </View>

      <TouchableOpacity style={styles.excelBtn} onPress={doExportSnapshot} disabled={!snapshot || exporting} activeOpacity={0.85}>
        {exporting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <NavIcon name="report" size={16} color="#fff" />
            <Text style={styles.excelBtnText}>Бүх хяналтын тайлан Excel татах</Text>
          </>
        )}
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.chatBody}
          onContentSizeChange={scrollEnd}
        >
          <View style={styles.quickWrap}>
            {QUICK_ACTIONS.map((a) => (
              <TouchableOpacity
                key={a.label}
                style={styles.quickChip}
                onPress={() => send(a.prompt)}
                disabled={sending || loadingSnap}
                activeOpacity={0.8}
              >
                <Text style={styles.quickChipText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
            >
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>{m.content}</Text>
              {m.tasks && m.tasks.length > 0 ? (
                <View style={styles.taskCard}>
                  <Text style={styles.taskCardTitle}>Санал болгосон ажлын хуваарь ({m.tasks.length})</Text>
                  {m.tasks.map((t, i) => (
                    <View key={i} style={styles.taskRow}>
                      <View style={[styles.taskPriority, { backgroundColor: priorityColor(t.priority, colors) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskEmp}>{t.employee || '—'}</Text>
                        <Text style={styles.taskDesc}>{t.task}</Text>
                        <Text style={styles.taskMeta}>SLA: {t.sla || '—'}{t.note ? ` · ${t.note}` : ''}</Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.taskExcelBtn} onPress={() => doExportTasks(m.tasks)} activeOpacity={0.85}>
                    <NavIcon name="report" size={15} color={colors.primary} />
                    <Text style={styles.taskExcelText}>Excel болгож татах</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}

          {sending ? (
            <View style={[styles.bubble, styles.bubbleAi, styles.typing]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Боловсруулж байна…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Асуулт бичих эсвэл ажил хуваарилах…"
            placeholderTextColor={colors.textFaint}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function priorityColor(p, colors) {
  if (p === 'high') return colors.danger;
  if (p === 'medium') return colors.warning;
  return colors.success;
}

function Stat({ styles, value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.primary,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { color: colors.onPrimaryContainer, fontSize: 34, fontWeight: '300', marginTop: -4 },
  headerRefresh: { color: colors.onPrimaryContainer, fontSize: 22, fontWeight: '700' },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.onPrimaryContainer, fontSize: 17, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  excelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  excelBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  chatBody: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quickChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  quickChipText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  bubble: { maxWidth: '92%', borderRadius: radius.lg, padding: spacing.md },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.primaryContainer },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: colors.onPrimaryContainer },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: colors.textMuted, fontSize: 13 },
  taskCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  taskCardTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  taskRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  taskPriority: { width: 6, alignSelf: 'stretch', borderRadius: 3, marginTop: 2 },
  taskEmp: { color: colors.text, fontWeight: '700', fontSize: 14 },
  taskDesc: { color: colors.text, fontSize: 13, marginTop: 1 },
  taskMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  taskExcelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  taskExcelText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
  sendBtnText: { color: colors.onPrimaryContainer, fontSize: 18, fontWeight: '800' },
});
