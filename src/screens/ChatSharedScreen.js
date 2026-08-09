import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as chatApi from '../services/chatService';
import { useTheme, useStyles } from '../context/ThemeContext';
import ChatImagePreview from '../components/ChatImagePreview';
import ChatVideoPreview from '../components/ChatVideoPreview';
import { formatTime, formatChatDay } from '../lib/formatTime';

const TABS = [
  { key: 'all', label: 'Бүгд' },
  { key: 'image', label: 'Зураг' },
  { key: 'video', label: 'Видео' },
  { key: 'file', label: 'Файл' },
];

const COLS = 3;
const GAP = 2;
const CELL = Math.floor((Dimensions.get('window').width - GAP * (COLS - 1)) / COLS);

function typeIcon(type) {
  if (type === 'image') return 'image-outline';
  if (type === 'video') return 'videocam-outline';
  return 'document-text-outline';
}

function typeLabel(type) {
  if (type === 'image') return 'Зураг';
  if (type === 'video') return 'Видео';
  return 'Файл';
}

export default function ChatSharedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { conversationId, title } = route.params || {};

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      setItems(await chatApi.fetchRoomAttachments(conversationId));
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((i) => i.attachment_type === tab);
  }, [items, tab]);

  const counts = useMemo(() => {
    const c = { all: items.length, image: 0, video: 0, file: 0 };
    items.forEach((i) => {
      if (c[i.attachment_type] != null) c[i.attachment_type] += 1;
    });
    return c;
  }, [items]);

  const openItem = (item) => {
    if (item.attachment_type === 'image') {
      setPreviewImage(item.attachment_url);
      return;
    }
    if (item.attachment_type === 'video') {
      setPreviewVideo(item.attachment_url);
      return;
    }
    if (item.attachment_url) Linking.openURL(item.attachment_url);
  };

  const showGrid =
    tab === 'image' ||
    tab === 'video' ||
    (tab === 'all' &&
      filtered.length > 0 &&
      filtered.every((i) => i.attachment_type === 'image' || i.attachment_type === 'video'));

  const renderGridItem = ({ item }) => (
    <TouchableOpacity style={styles.gridCell} onPress={() => openItem(item)} activeOpacity={0.85}>
      {item.attachment_type === 'image' ? (
        <Image source={{ uri: item.attachment_url }} style={styles.gridImage} />
      ) : (
        <View style={styles.gridVideo}>
          <Ionicons name="play-circle" size={36} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderListItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => openItem(item)} activeOpacity={0.7}>
      {item.attachment_type === 'image' ? (
        <Image source={{ uri: item.attachment_url }} style={styles.rowThumb} />
      ) : (
        <View style={[styles.rowIcon, item.attachment_type === 'video' && styles.rowIconVideo]}>
          <Ionicons name={typeIcon(item.attachment_type)} size={22} color="#fff" />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.attachment_name || typeLabel(item.attachment_type)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.sender_name} · {formatChatDay(item.created_at)} · {formatTime(item.created_at)}
        </Text>
      </View>
      <Ionicons
        name={item.attachment_type === 'file' ? 'download-outline' : 'chevron-forward'}
        size={18}
        color={colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable style={styles.headerBack} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>Хуваалцсан файл</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{title || 'Чат'}</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
                {counts[t.key] ? ` ${counts[t.key]}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          key={showGrid ? 'grid' : 'list'}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={showGrid ? COLS : 1}
          contentContainerStyle={filtered.length ? undefined : styles.emptyList}
          columnWrapperStyle={showGrid ? styles.gridRow : undefined}
          renderItem={showGrid ? renderGridItem : renderListItem}
          ItemSeparatorComponent={showGrid ? null : () => <View style={styles.divider} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Файл алга</Text>
              <Text style={styles.emptySub}>Энэ чатад илгээсэн зураг, видео, файл энд харагдана</Text>
            </View>
          }
        />
      )}

      <ChatImagePreview uri={previewImage} onClose={() => setPreviewImage(null)} />
      <ChatVideoPreview uri={previewVideo} onClose={() => setPreviewVideo(null)} />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerSafe: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: colors.primary,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: { flex: 1, minWidth: 0, paddingRight: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 1 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridRow: { gap: GAP },
  gridCell: {
    width: CELL,
    height: CELL,
    marginBottom: GAP,
    backgroundColor: colors.surfaceContainerHigh,
  },
  gridImage: { width: '100%', height: '100%' },
  gridVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A3A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconVideo: { backgroundColor: '#5B6B7C' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 74,
  },
  emptyList: { flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
