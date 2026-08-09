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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { EmptyState } from '../components/ui';
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
    return (
      <View style={[styles.convAvatar, { backgroundColor: avatarColor(conv.title || 'G') }]}>
        <Ionicons name="people" size={26} color="#fff" />
      </View>
    );
  }

  const emp = findEmployeeForConv(conv, meId, employees);
  if (emp?.avatar_url) {
    return <Image source={{ uri: emp.avatar_url }} style={styles.convAvatarImg} />;
  }
  return (
    <View style={[styles.convAvatar, { backgroundColor: avatarColor(conv.title) }]}>
      <Text style={styles.convAvatarText}>{initials(conv.title)}</Text>
    </View>
  );
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
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isCloud, fetchEmployees } = useApp();
  const me = currentUser;
  const [employees, setEmployees] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud || !me?.id) return;
    try {
      const [emps, convs] = await Promise.all([
        fetchEmployees().catch(() => []),
        chatApi.fetchMyConversations(me.id).catch(() => []),
      ]);
      setEmployees(emps.filter((e) => e.id !== me.id));
      setConversations(convs);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, me?.id, fetchEmployees]);

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

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Чатууд</Text>
          </View>
        </SafeAreaView>
        <EmptyState text="Чат хийхэд Supabase холбогдсон байх шаардлагатай." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Чатууд</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('ChatArchive')} hitSlop={8}>
              <Ionicons name="archive-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('NewGroup')} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <FlatList
        data={sortedConversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {error ? (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleStrip}
            >
              <TouchableOpacity
                style={styles.personCard}
                onPress={() => navigation.navigate('GennetexAi')}
                activeOpacity={0.8}
              >
                <View style={[styles.personAvatar, styles.personAvatarAi]}>
                  <Image source={GENNETEX_LOGO} style={styles.aiLogoImg} resizeMode="contain" />
                </View>
                <Text style={styles.personName} numberOfLines={2}>Gennetex AI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.personCard}
                onPress={() => navigation.navigate('TelegramChat')}
                activeOpacity={0.8}
              >
                <View style={[styles.personAvatar, { backgroundColor: '#229ED9' }]}>
                  <Ionicons name="paper-plane" size={26} color="#fff" />
                </View>
                <Text style={styles.personName} numberOfLines={2}>Telegram</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.personCard}
                onPress={() => navigation.navigate('NewGroup')}
                activeOpacity={0.8}
              >
                <View style={[styles.personAvatar, styles.personAvatarNew]}>
                  <Ionicons name="people" size={26} color={colors.primary} />
                </View>
                <Text style={styles.personName} numberOfLines={2}>Шинэ групп</Text>
              </TouchableOpacity>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={styles.personCard}
                  onPress={() => openDirect(emp)}
                  activeOpacity={0.8}
                >
                  <View style={styles.personAvatarWrap}>
                    {emp.avatar_url ? (
                      <Image source={{ uri: emp.avatar_url }} style={styles.personAvatarImg} />
                    ) : (
                      <View style={[styles.personAvatar, { backgroundColor: avatarColor(emp.name) }]}>
                        <Text style={styles.personAvatarText}>{initials(emp.name)}</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.personDot,
                        { backgroundColor: isOnline(emp.last_seen) ? colors.success : colors.textFaint },
                      ]}
                    />
                  </View>
                  <Text style={styles.personName} numberOfLines={2}>
                    {emp.name || 'Ажилтан'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.listDivider} />

            <TouchableOpacity
              style={styles.aiRow}
              onPress={() => navigation.navigate('GennetexAi')}
              activeOpacity={0.7}
            >
              <View style={styles.aiAvatar}>
                <Image source={GENNETEX_LOGO} style={styles.aiLogoImgLg} resizeMode="contain" />
              </View>
              <View style={styles.aiBody}>
                <View style={styles.convTop}>
                  <Text style={styles.aiTitle}>Gennetex AI</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                </View>
                <Text style={styles.aiLast} numberOfLines={1}>
                  Сүлжээний асуултаа асуугаарай · заавар + YouTube
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow
            conv={item}
            me={me}
            employees={employees}
            onPress={() => openConversation(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Яриа алга</Text>
            <Text style={styles.emptySub}>Дээрх ажилтан дээр дарж эхлүүлнэ үү</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerSafe: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingBottom: 110 },
  errorBar: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: { color: '#B91C1C', fontSize: 13 },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    gap: 12,
  },
  convAvatarWrap: { position: 'relative' },
  convAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  convAvatarImg: { width: 54, height: 54, borderRadius: 27 },
  convAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
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
  convTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  convTime: { color: colors.textMuted, fontSize: 13, flexShrink: 0 },
  convBottom: { flexDirection: 'row', alignItems: 'center' },
  convCheck: { marginRight: 3 },
  convLast: { flex: 1, color: colors.textMuted, fontSize: 15, lineHeight: 19 },
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
