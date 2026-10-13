import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Pressable,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { EmptyState } from '../components/ui';
import { Avatar as DsAvatar } from '../components/ds';
import * as chatApi from '../services/chatService';
import { formatConvTime } from '../lib/formatTime';
import { isOnline } from '../lib/online';

const GENNETEX_LOGO = require('../../assets/logo.png');

const AVATAR_COLORS = [
  '#E17076', '#7BC862', '#E5CA77', '#65AADD',
  '#A695E7', '#EE7AAE', '#6EC9CB', '#FAA774',
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function lastMessagePreview(conv, me) {
  const last = conv.last;
  if (!last) return 'Мессеж алга';
  const body =
    last.content ||
    (last.attachment_type === 'image'
      ? '🖼 Зураг'
      : last.attachment_type === 'video'
      ? '🎬 Видео'
      : last.attachment_type === 'file'
      ? '📎 Файл'
      : '');
  if (conv.is_group) return `${last.sender_name}: ${body}`;
  if (last.sender_id === me?.id || last.sender_name === me?.name) return `Та: ${body}`;
  return body;
}

function findEmployeeForConv(conv, meId, employees) {
  const other = conv.members?.find((m) => m.user_id !== meId);
  if (!other) return null;
  return employees.find((e) => e.id === other.user_id) || null;
}

function ConversationAvatar({ conv, meId, employees }) {
  const styles = useStyles(makeStyles);
  if (conv.is_group) {
    if (conv.avatar_url) {
      return <Image source={{ uri: conv.avatar_url }} style={styles.convAvatarImg} />;
    }
    // Prototype: бүлэг — өнгөт дугуй + 2 үсэг.
    return (
      <View style={[styles.convAvatar, { backgroundColor: avatarColor(conv.title || 'G') }]}>
        <Text style={styles.convAvatarText}>{String(conv.title || 'Бүлэг').slice(0, 2)}</Text>
      </View>
    );
  }

  // Хувь хүн — зураг, эсвэл дизайны зурсан хүний дүрс.
  const emp = findEmployeeForConv(conv, meId, employees);
  return <DsAvatar uri={emp?.avatar_url} name={conv.title || ''} size={48} />;
}

function ConversationRow({ conv, me, employees, onPress }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const preview = lastMessagePreview(conv, me);
  const emp = findEmployeeForConv(conv, me?.id, employees);
  const online = !conv.is_group && emp && isOnline(emp.last_seen);
  const mineLast = conv.last && (conv.last.sender_id === me?.id || conv.last.sender_name === me?.name);

  return (
    <TouchableOpacity style={styles.convRow} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.convAvatarWrap}>
        <ConversationAvatar conv={conv} meId={me?.id} employees={employees} />
        {online ? <View style={styles.convOnlineDot} /> : null}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convTop}>
          <Text style={styles.convTitle} numberOfLines={1}>
            {conv.title}
          </Text>
          {conv.last?.created_at ? (
            <Text style={styles.convTime}>{formatConvTime(conv.last.created_at)}</Text>
          ) : null}
        </View>
        <View style={styles.convBottom}>
          {mineLast ? (
            <Ionicons name="checkmark-done" size={16} color={colors.primary} style={styles.convCheck} />
          ) : null}
          <Text style={styles.convLast} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isCloud, fetchDirectory } = useApp();
  const me = currentUser;
  const [employees, setEmployees] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!isCloud || !me?.id) return;
    try {
      const [emps, convs] = await Promise.all([
        fetchDirectory().catch(() => []),
        chatApi.fetchMyConversations(me.id).catch(() => []),
      ]);
      setEmployees(emps.filter((e) => e.id !== me.id));
      setConversations(convs);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, me?.id, fetchDirectory]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!isCloud || !me?.id) return;
      const unsub = chatApi.subscribeConversations(me.id, load);
      return unsub;
    }, [load, isCloud, me?.id])
  );

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const ta = a.last?.created_at ? new Date(a.last.created_at).getTime() : 0;
      const tb = b.last?.created_at ? new Date(b.last.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [conversations]);

  const openDirect = async (emp) => {
    try {
      const conv = await chatApi.getOrCreateDirect(
        { id: me.id, name: me.name },
        { id: emp.id, name: emp.name }
      );
      navigation.navigate('Conversation', {
        conversationId: conv.id,
        title: emp.name,
        isGroup: false,
        otherUser: {
          id: emp.id,
          name: emp.name,
          avatar_url: emp.avatar_url || null,
          last_seen: emp.last_seen || null,
        },
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const openConversation = (c) => {
    const other = c.members?.find((m) => m.user_id !== me.id);
    const emp = other ? employees.find((e) => e.id === other.user_id) : null;
    navigation.navigate('Conversation', {
      conversationId: c.id,
      title: c.title,
      isGroup: c.is_group,
      memberCount: c.members?.length || 0,
      groupAvatarUrl: c.avatar_url || null,
      otherUser: other
        ? {
            id: other.user_id,
            name: other.user_name,
            avatar_url: emp?.avatar_url || null,
            last_seen: emp?.last_seen || null,
          }
        : null,
    });
  };

  // Хайлт — яриа болон ажилтан (шинэ яриа эхлүүлэх) хоёуланг шүүнэ.
  const q = query.trim().toLowerCase();
  const shownConvs = q ? sortedConversations.filter((c) => String(c.title || '').toLowerCase().includes(q)) : sortedConversations;
  const convPeople = new Set(conversations.filter((c) => !c.is_group).flatMap((c) => (c.members || []).map((m) => m.user_id)));
  const shownPeople = q
    ? employees.filter((e) => `${e.last_name || ''} ${e.name || ''}`.toLowerCase().includes(q))
    : employees.filter((e) => !convPeople.has(e.id)).slice(0, 0);

  const header = (
    <SafeAreaView edges={['top']} style={styles.header}>
      <Text style={styles.headerTitle}>Чат</Text>
      <View style={styles.headerActions}>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('ChatArchive')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Архив">
          <Ionicons name="archive-outline" size={20} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('NewGroup')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Шинэ яриа">
          <Ionicons name="create-outline" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </SafeAreaView>
  );

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.ground} />
        {header}
        <EmptyState text="Чат хийхэд Supabase холбогдсон байх шаардлагатай." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.ground} />
      {header}
      <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.search}>
          <Ionicons name="search" size={19} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Хүн, бүлэг хайх"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Цэвэрлэх">
              <Ionicons name="close-circle" size={18} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          {!q ? (
            <>
              <TouchableOpacity style={styles.convRow} onPress={() => navigation.navigate('GennetexAi')} activeOpacity={0.65}>
                <View style={[styles.convAvatar, { backgroundColor: colors.ai }]}>
                  <Text style={styles.convAvatarText}>Ge</Text>
                </View>
                <View style={styles.convBody}>
                  <View style={styles.convTop}>
                    <Text style={styles.convTitle} numberOfLines={1}>Gennetex AI</Text>
                  </View>
                  <Text style={styles.convLast} numberOfLines={1}>Сүлжээний асуултаа асуугаарай · заавар + YouTube</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.convRow, styles.rowBorder]} onPress={() => navigation.navigate('TelegramChat')} activeOpacity={0.65}>
                <View style={[styles.convAvatar, { backgroundColor: '#229ED9' }]}>
                  <Ionicons name="paper-plane" size={22} color="#fff" />
                </View>
                <View style={styles.convBody}>
                  <Text style={styles.convTitle} numberOfLines={1}>Telegram</Text>
                  <Text style={styles.convLast} numberOfLines={1}>Telegram групп, ярианууд</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}
          {shownConvs.map((item, i) => (
            <View key={item.id} style={(i > 0 || !q) && styles.rowBorder}>
              <ConversationRow conv={item} me={me} employees={employees} onPress={() => openConversation(item)} />
            </View>
          ))}
          {shownPeople.map((emp, i) => (
            <TouchableOpacity
              key={emp.id}
              style={[styles.convRow, (i > 0 || shownConvs.length > 0) && styles.rowBorder]}
              onPress={() => openDirect(emp)}
              activeOpacity={0.65}
            >
              <View style={styles.convAvatarWrap}>
                <DsAvatar uri={emp.avatar_url} name={emp.name || ''} size={48} online={isOnline(emp.last_seen)} />
              </View>
              <View style={styles.convBody}>
                <Text style={styles.convTitle} numberOfLines={1}>{[emp.last_name, emp.name].filter(Boolean).join(' ') || 'Ажилтан'}</Text>
                <Text style={styles.convLast} numberOfLines={1}>{emp.position || 'Шинэ яриа эхлүүлэх'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {q && !shownConvs.length && !shownPeople.length ? (
            <Text style={styles.emptySub}>«{query}» олдсонгүй</Text>
          ) : null}
        </View>
        {!q && !sortedConversations.length ? (
          <Text style={styles.hint}>Шинэ яриа эхлүүлэхдээ хайлтад ажилтны нэрийг бичнэ үү.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F1722',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    marginBottom: 12,
    shadowColor: '#0F1722',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, padding: 0 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 14 },
  headerSafe: { backgroundColor: colors.surfaceDim },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.ground,
  },
  // Дизайн: «Чат» 30/700 гарчиг.
  headerTitle: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 110 },
  errorBar: {
    backgroundColor: colors.danger + "1f",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  peopleStrip: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 4,
  },
  personCard: {
    width: 72,
    alignItems: 'center',
    marginRight: 8,
  },
  personAvatarWrap: { position: 'relative', marginBottom: 6 },
  personAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  personAvatarNew: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  personAvatarAi: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#0F766E' },
  aiLogoImg: { width: 40, height: 40 },
  aiLogoImgLg: { width: 40, height: 40 },
  personAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  personAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  personDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  personName: {
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerHigh,
    gap: 12,
  },
  aiAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  aiBody: { flex: 1, minWidth: 0 },
  aiTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  aiBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  aiLast: { color: '#0F766E', fontSize: 14, fontWeight: '500' },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    gap: 12,
  },
  convAvatarWrap: { position: 'relative' },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  convAvatarImg: { width: 54, height: 54, borderRadius: 27 },
  convAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  convOnlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  convBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
    borderBottomWidth: 0,
  },
  convTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  convTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
  convTime: { color: colors.faint, fontSize: 12, flexShrink: 0, fontVariant: ['tabular-nums'] },
  convBottom: { flexDirection: 'row', alignItems: 'center' },
  convCheck: { marginRight: 3 },
  convLast: { flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 18, marginTop: 2 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 78,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
