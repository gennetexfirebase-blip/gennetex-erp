import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { ERP_NOT_FOUND } from '../lib/erpMessages';
import * as feedApi from '../services/feedService';
import { formatRelativeTime } from '../lib/formatTime';

const REACTION_OPTIONS = [
  { key: 'like', emoji: '👍', label: 'Like', color: '#0866FF' },
  { key: 'love', emoji: '❤️', label: 'Love', color: '#F33E58' },
  { key: 'care', emoji: '🤗', label: 'Care', color: '#F7B125' },
  { key: 'haha', emoji: '😆', label: 'Haha', color: '#F7B125' },
  { key: 'angry', emoji: '😠', label: 'Angry', color: '#E9710F' },
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function FeedPostScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { postId } = route.params || {};
  const { currentUser } = useApp();
  const me = currentUser;

  const [post, setPost] = useState(null);
  const [booting, setBooting] = useState(true);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    const started = Date.now();
    try {
      const data = await feedApi.fetchPostById(postId);
      setPost(data);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      const wait = Math.max(0, 700 - (Date.now() - started));
      setTimeout(() => setBooting(false), wait);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const myReact = post?.reactions?.find((r) => r.user_id === me?.id)?.reaction;
  const active = REACTION_OPTIONS.find((r) => r.key === myReact);

  const handleReact = async (reaction) => {
    if (!me || !post) return;
    try {
      await feedApi.setReaction({
        postId: post.id,
        userId: me.id,
        userName: me.name,
        reaction,
        postAuthorId: post.author_id,
      });
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const handleShare = async () => {
    if (!me || !post) return;
    setSharing(true);
    try {
      await feedApi.sharePost({ post, authorId: me.id, authorName: me.name });
      Alert.alert('Амжилттай', 'Постыг хуваалцлаа');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSharing(false);
    }
  };

  const handleComment = async () => {
    const text = comment.trim();
    if (!text || !me || !post) return;
    setCommenting(true);
    try {
      await feedApi.addComment({
        postId: post.id,
        userId: me.id,
        userName: me.name,
        content: text,
        postAuthorId: post.author_id,
      });
      setComment('');
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setCommenting(false);
    }
  };

  if (booting) {
    return (
      <View style={styles.boot}>
        <StatusBar barStyle="dark-content" />
        <Image source={require('../../assets/logo.png')} style={styles.bootLogo} resizeMode="contain" />
        <Text style={styles.bootBrand}>gennetex</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
      </View>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Пост</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.empty}>{ERP_NOT_FOUND}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Пост</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.header}
              onPress={() => navigation.navigate('FeedProfile', { userId: post.author_id })}
            >
              {post.author_avatar_url ? (
                <Image source={{ uri: post.author_avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(post.author_name)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.author}>{post.author_name}</Text>
                <Text style={styles.time}>{formatRelativeTime(post.created_at)}</Text>
              </View>
            </TouchableOpacity>

            {post.content ? <Text style={styles.content}>{post.content}</Text> : null}
            {post.tags?.length ? (
              <View style={styles.tagsRow}>
                {post.tags.map((t) => (
                  <TouchableOpacity
                    key={t.user_id}
                    onPress={() => navigation.navigate('FeedProfile', { userId: t.user_id })}
                  >
                    <Text style={styles.tagChip}>@{t.user_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {post.image_url ? (
              <Image source={{ uri: post.image_url }} style={styles.image} resizeMode="cover" />
            ) : null}

            <View style={styles.stats}>
              <Text style={styles.statsText}>{post.reactionTotal || 0} reaction</Text>
              <Text style={styles.statsText}>{post.commentCount || 0} сэтгэгдэл</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => handleReact(myReact || 'like')}
                onLongPress={() => setPickerOpen(true)}
              >
                <Text style={styles.actionEmoji}>{active?.emoji || '👍'}</Text>
                <Text style={[styles.actionLabel, myReact && { color: active?.color }]}>
                  {active?.label || 'Like'}
                </Text>
              </Pressable>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare} disabled={sharing}>
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="arrow-redo-outline" size={20} color={colors.textMuted} />
                )}
                <Text style={styles.actionLabel}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.commentsCard}>
            <Text style={styles.commentsTitle}>Сэтгэгдэл</Text>
            {(post.comments || []).map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <TouchableOpacity onPress={() => navigation.navigate('FeedProfile', { userId: c.user_id })}>
                  {c.user_avatar_url ? (
                    <Image source={{ uri: c.user_avatar_url }} style={styles.commentAvatarImg} />
                  ) : (
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{initials(c.user_name)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.commentBody}>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{c.user_name}</Text>
                    <Text style={styles.commentText}>{c.content}</Text>
                  </View>
                  <Text style={styles.commentTime}>{formatRelativeTime(c.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Сэтгэгдэл бичих..."
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity onPress={handleComment} disabled={!comment.trim() || commenting}>
            {commenting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="send" size={22} color={comment.trim() ? colors.primary : colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={styles.picker}>
            {REACTION_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={styles.pickerItem}
                onPress={() => {
                  setPickerOpen(false);
                  handleReact(r.key);
                }}
              >
                <Text style={styles.pickerEmoji}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootLogo: { width: 140, height: 110 },
  bootBrand: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, marginBottom: 8, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh },
  avatarText: { color: colors.primary, fontWeight: '800' },
  author: { color: colors.text, fontWeight: '700', fontSize: 15 },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  content: { color: colors.text, fontSize: 16, lineHeight: 22, paddingHorizontal: 12, marginTop: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 8 },
  tagChip: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  image: { width: '100%', height: 280, marginTop: 10, backgroundColor: colors.surfaceContainerHigh },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsText: { color: colors.textMuted, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionEmoji: { fontSize: 18 },
  actionLabel: { color: colors.textMuted, fontWeight: '700' },
  commentsCard: { backgroundColor: colors.surface, padding: 12, gap: 12 },
  commentsTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  commentRow: { flexDirection: 'row', gap: 8 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarImg: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh },
  commentAvatarText: { color: colors.textMuted, fontWeight: '700', fontSize: 11 },
  commentBody: { flex: 1 },
  commentBubble: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  commentAuthor: { color: colors.text, fontWeight: '700', fontSize: 13 },
  commentText: { color: colors.text, fontSize: 14, marginTop: 1 },
  commentTime: { color: colors.textMuted, fontSize: 11, marginTop: 3, marginLeft: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    color: colors.text,
  },
  center: { alignItems: 'center', padding: 40 },
  empty: { color: colors.textMuted },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 40,
    padding: 8,
  },
  pickerItem: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pickerEmoji: { fontSize: 30 },
});
