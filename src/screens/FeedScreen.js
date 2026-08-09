import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as feedApi from '../services/feedService';
import * as meetingApi from '../services/meetingService';
import LiveStreamModal, { liveRoomFromId } from '../components/LiveStreamModal';
import { formatRelativeTime } from '../lib/formatTime';

const REACTION_OPTIONS = [
  { key: 'like', emoji: '👍', label: 'Like', color: '#1877F2' },
  { key: 'love', emoji: '❤️', label: 'Love', color: '#F33E58' },
  { key: 'care', emoji: '🤗', label: 'Care', color: '#F7B125' },
  { key: 'haha', emoji: '😆', label: 'Haha', color: '#F7B125' },
  { key: 'angry', emoji: '😠', label: 'Angry', color: '#E9710F' },
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_W = 112;
const STORY_H = 200;

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

function myReaction(post, userId) {
  return post.reactions?.find((r) => r.user_id === userId)?.reaction || null;
}

function Avatar({ name, size = 40, uri, onPress }) {
  const styles = useStyles(makeStyles);
  const body = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarLetter, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  );
}

function StoriesRow({ me, authProfile, storyGroups, onCreate, onOpen, creating }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const myGroup = storyGroups.find((g) => g.author_id === me?.id);
  const others = storyGroups.filter((g) => g.author_id !== me?.id);

  return (
    <View style={styles.storiesWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesScroll}
      >
        {/* Create story — Figma style */}
        <TouchableOpacity style={styles.storyCard} onPress={onCreate} activeOpacity={0.9} disabled={creating}>
          <View style={styles.createStoryPhoto}>
            {creating ? (
              <ActivityIndicator color={colors.primary} />
            ) : authProfile?.avatar_url ? (
              <Image source={{ uri: authProfile.avatar_url }} style={styles.createStoryImg} />
            ) : (
              <View style={styles.createStoryPlaceholder}>
                <Text style={styles.createStoryPlaceholderText}>{initials(me?.name)}</Text>
              </View>
            )}
          </View>
          <View style={styles.createStoryFooter}>
            <View style={styles.createPlus}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
            <Text style={styles.createStoryLabel}>Story{'\n'}үүсгэх</Text>
          </View>
        </TouchableOpacity>

        {myGroup ? (
          <TouchableOpacity style={styles.storyCard} activeOpacity={0.9} onPress={() => onOpen(myGroup)}>
            <Image source={{ uri: myGroup.coverUrl }} style={styles.storyImg} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={styles.storyShade} />
            <View style={[styles.storyRing, styles.storyRingBlue]}>
              <Avatar name={me?.name} size={32} uri={authProfile?.avatar_url} />
            </View>
            <Text style={styles.storyName} numberOfLines={2}>Your story</Text>
          </TouchableOpacity>
        ) : null}

        {others.map((g) => (
          <TouchableOpacity key={g.author_id} style={styles.storyCard} activeOpacity={0.9} onPress={() => onOpen(g)}>
            <Image source={{ uri: g.coverUrl }} style={styles.storyImg} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={styles.storyShade} />
            {g.hasUnseen ? (
              <LinearGradient
                colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.storyRing}
              >
                <View style={styles.storyRingWhite}>
                  <Avatar name={g.author_name} size={28} uri={g.author_avatar_url} />
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.storyRing, styles.storyRingSeen]}>
                <Avatar name={g.author_name} size={28} uri={g.author_avatar_url} />
              </View>
            )}
            <Text style={styles.storyName} numberOfLines={2}>{g.author_name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function StoryViewer({ group, me, onClose, onViewed }) {
  const styles = useStyles(makeStyles);
  const stories = group?.stories || [];
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const story = stories[index];

  useEffect(() => {
    setIndex(0);
  }, [group?.author_id]);

  useEffect(() => {
    if (!story) return;
    onViewed?.(story);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose?.();
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [story?.id, index]);

  if (!group || !story) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.viewer}>
        <Image source={{ uri: story.image_url }} style={styles.viewerImage} resizeMode="contain" />
        <View style={styles.viewerTop}>
          <View style={styles.viewerBars}>
            {stories.map((s, i) => (
              <View key={s.id} style={styles.viewerBarTrack}>
                <View
                  style={[
                    styles.viewerBarFill,
                    i < index && styles.viewerBarDone,
                    i === index && styles.viewerBarActive,
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.viewerHeader}>
            <Avatar name={group.author_name} size={36} uri={group.author_avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={styles.viewerName}>{group.author_name}</Text>
              <Text style={styles.viewerTime}>{formatRelativeTime(story.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.viewerTouchRow}>
          <Pressable
            style={styles.viewerTouch}
            onPress={() => (index > 0 ? setIndex((i) => i - 1) : onClose?.())}
          />
          <Pressable
            style={styles.viewerTouch}
            onPress={() => (index < stories.length - 1 ? setIndex((i) => i + 1) : onClose?.())}
          />
        </View>
      </View>
    </Modal>
  );
}

const REACT_BADGE_BG = {
  like: '#1877F2',
  love: '#F33E58',
  care: '#F7B125',
  haha: '#F7B125',
  angry: '#E9710F',
};

function ReactionBadges({ counts = {} }) {
  const styles = useStyles(makeStyles);
  const active = REACTION_OPTIONS.filter((r) => counts[r.key] > 0).slice(0, 3);
  if (!active.length) return null;
  return (
    <View style={styles.reactBadges}>
      {active.map((r, i) => (
        <View
          key={r.key}
          style={[
            styles.reactBadge,
            { backgroundColor: REACT_BADGE_BG[r.key], marginLeft: i ? -5 : 0, zIndex: 3 - i },
          ]}
        >
          <Text style={styles.reactBadgeEmoji}>{r.emoji}</Text>
        </View>
      ))}
    </View>
  );
}

function PostCard({
  post,
  me,
  onReact,
  onOpenReactPicker,
  onShare,
  sharing,
  onComment,
  onDelete,
  onOpenPost,
  onOpenProfile,
  commentText,
  onChangeComment,
  commenting,
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const mine = post.author_id === me?.id;
  const reacted = myReaction(post, me?.id);
  const active = REACTION_OPTIONS.find((r) => r.key === reacted);
  const previewComments = (post.comments || []).slice(-2);
  const hasStats = post.reactionTotal > 0 || post.commentCount > 0;
  const hasComments = previewComments.length > 0;

  const openMenu = () => {
    if (!mine) {
      onOpenPost?.(post);
      return;
    }
    Alert.alert(post.author_name || 'Пост', undefined, [
      { text: 'Пост нээх', onPress: () => onOpenPost?.(post) },
      { text: 'Устгах', style: 'destructive', onPress: () => onDelete(post) },
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar
          name={post.author_name}
          size={42}
          uri={post.author_avatar_url}
          onPress={() => onOpenProfile?.(post.author_id)}
        />
        <TouchableOpacity style={styles.postHeaderMeta} onPress={() => onOpenProfile?.(post.author_id)} activeOpacity={0.7}>
          <Text style={styles.postAuthor} numberOfLines={1}>{post.author_name || 'Ажилтан'}</Text>
          <View style={styles.postMetaRow}>
            <Text style={styles.postTime}>{formatRelativeTime(post.created_at)}</Text>
            <View style={styles.metaDot} />
            <Ionicons name="earth" size={11} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreBtn} onPress={openMenu} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Pressable onPress={() => onOpenPost?.(post)} style={styles.postBodyWrap}>
        {post.content ? <Text style={styles.postBody}>{post.content}</Text> : null}
        {post.tags?.length ? (
          <View style={styles.tagsRow}>
            {post.tags.map((t) => (
              <TouchableOpacity
                key={t.user_id}
                style={styles.tagChip}
                onPress={() => onOpenProfile?.(t.user_id)}
              >
                <Text style={styles.tagText}>@{t.user_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </Pressable>

      {post.image_url ? (
        <Pressable onPress={() => onOpenPost?.(post)}>
          <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
        </Pressable>
      ) : null}

      {hasStats ? (
        <View style={styles.countsRow}>
          <TouchableOpacity style={styles.countsLeft} onPress={() => onOpenReactPicker(post)} activeOpacity={0.7}>
            <ReactionBadges counts={post.reactionCounts} />
            {post.reactionTotal > 0 ? (
              <Text style={styles.countsText}>{post.reactionTotal}</Text>
            ) : null}
          </TouchableOpacity>
          {post.commentCount > 0 ? (
            <TouchableOpacity onPress={() => onOpenPost?.(post)} activeOpacity={0.7}>
              <Text style={styles.countsText}>
                {post.commentCount} сэтгэгдэл
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actionsDivider, !hasStats && styles.actionsDividerTight]} />
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => onReact(post, reacted || 'like')}
          onLongPress={() => onOpenReactPicker(post)}
          delayLongPress={220}
        >
          {reacted ? (
            <Text style={styles.actionEmoji}>{active?.emoji}</Text>
          ) : (
            <Ionicons name="thumbs-up-outline" size={20} color={colors.textMuted} />
          )}
          <Text style={[styles.actionLabel, reacted && { color: active?.color }]}>
            {active?.label || 'Like'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => onOpenPost?.(post)}
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
          <Text style={styles.actionLabel}>Сэтгэгдэл</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => onShare?.(post)}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="arrow-redo-outline" size={20} color={colors.textMuted} />
          )}
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.commentsBlock}>
        {post.commentCount > 2 ? (
          <TouchableOpacity onPress={() => onOpenPost?.(post)} activeOpacity={0.7}>
            <Text style={styles.viewMoreComments}>
              Бүх сэтгэгдэл харах ({post.commentCount})
            </Text>
          </TouchableOpacity>
        ) : null}

        {hasComments
          ? previewComments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Avatar
                  name={c.user_name}
                  size={34}
                  uri={c.user_avatar_url}
                  onPress={() => onOpenProfile?.(c.user_id)}
                />
                <Pressable style={styles.commentBubble} onPress={() => onOpenPost?.(post)}>
                  <Text style={styles.commentAuthor}>{c.user_name || 'Ажилтан'}</Text>
                  <Text style={styles.commentText} numberOfLines={3}>{c.content}</Text>
                </Pressable>
              </View>
            ))
          : null}

        <View style={styles.writeCommentRow}>
          <Avatar name={me?.name} size={34} uri={me?.avatar_url} />
          <View style={styles.writeCommentField}>
            <TextInput
              style={styles.writeCommentInput}
              placeholder="Сэтгэгдэл бичих..."
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={onChangeComment}
              multiline
            />
            {(commentText?.trim() || commenting) && (
              <TouchableOpacity
                onPress={() => onComment(post)}
                disabled={!commentText?.trim() || commenting}
                style={styles.sendBtn}
              >
                {commenting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="send" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, isCloud, fetchEmployees } = useApp();
  const me = currentUser;

  const [posts, setPosts] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [composer, setComposer] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [storyCreating, setStoryCreating] = useState(false);
  const [viewerGroup, setViewerGroup] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentingId, setCommentingId] = useState(null);
  const [pickerPost, setPickerPost] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingIsHost, setMeetingIsHost] = useState(false);
  const [sharingId, setSharingId] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud || !me?.id) return;
    try {
      const [feed, stories, meeting] = await Promise.all([
        feedApi.fetchFeed(),
        feedApi.fetchStories(me.id).catch(() => []),
        meetingApi.fetchActiveMeeting(meetingApi.KIND_LIVE).catch(() => null),
      ]);
      setPosts(feed);
      setStoryGroups(stories);
      // Зөвхөн live stream (хурал биш)
      setActiveMeeting(meeting?.kind === meetingApi.KIND_LIVE ? meeting : null);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCloud, me?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      fetchEmployees()
        .then((list) => setEmployees((list || []).filter((e) => e.id !== me?.id)))
        .catch(() => setEmployees([]));
    }, [load, fetchEmployees, me?.id])
  );

  useEffect(() => {
    if (!isCloud) return;
    const unsubFeed = feedApi.subscribeFeed({
      onPost: () => load(),
      onReaction: () => load(),
      onComment: () => load(),
      onStory: () => load(),
    });
    const unsubMeeting = meetingApi.subscribeMeetings(() => {
      meetingApi
        .fetchActiveMeeting(meetingApi.KIND_LIVE)
        .then((m) => setActiveMeeting(m?.kind === meetingApi.KIND_LIVE ? m : null))
        .catch(() => setActiveMeeting(null));
    });
    return () => {
      unsubFeed?.();
      unsubMeeting?.();
    };
  }, [isCloud, load]);

  // Push — зөвхөн live stream нээх
  useEffect(() => {
    if (!route.params?.openLiveId || !me?.id) return;
    const hostId = route.params.openLiveHostId;
    setActiveMeeting((prev) =>
      prev?.id === route.params.openLiveId
        ? prev
        : {
            id: route.params.openLiveId,
            host_id: hostId,
            host_name: route.params.openLiveHost || 'Ажилтан',
            kind: meetingApi.KIND_LIVE,
            status: 'active',
          }
    );
    setMeetingIsHost(hostId === me.id);
    setMeetingOpen(true);
    navigation.setParams({
      openLiveId: undefined,
      openLiveHost: undefined,
      openLiveHostId: undefined,
    });
  }, [route.params?.openLiveId, me?.id, navigation]);

  const startLive = async () => {
    if (!me?.id) return;
    if (activeMeeting?.host_id === me.id) {
      setMeetingIsHost(true);
      setMeetingOpen(true);
      return;
    }
    if (activeMeeting?.id) {
      Alert.alert('Live', 'Одоо өөр live явагдаж байна. Эхлээд түүнд орно уу.', [
        { text: 'Орох', onPress: () => joinMeeting() },
        { text: 'Болих', style: 'cancel' },
      ]);
      return;
    }
    try {
      const meeting = await meetingApi.startMeeting({
        hostId: me.id,
        hostName: me.name,
        title: `${me.name} Live`,
        kind: meetingApi.KIND_LIVE,
      });
      setActiveMeeting(meeting);
      setMeetingIsHost(true);
      setMeetingOpen(true);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const joinMeeting = () => {
    if (!activeMeeting?.id) return;
    setMeetingIsHost(activeMeeting.host_id === me?.id);
    setMeetingOpen(true);
  };

  const closeMeeting = async () => {
    const wasHost = meetingIsHost;
    const id = activeMeeting?.id;
    setMeetingOpen(false);
    setMeetingIsHost(false);
    if (wasHost && id) {
      try {
        await meetingApi.endMeeting(id, me?.id);
      } catch (e) {}
    }
    meetingApi
      .fetchActiveMeeting(meetingApi.KIND_LIVE)
      .then((m) => setActiveMeeting(m?.kind === meetingApi.KIND_LIVE ? m : null))
      .catch(() => setActiveMeeting(null));
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const createStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (res.canceled) return;
    setStoryCreating(true);
    try {
      await feedApi.createStory({
        authorId: me.id,
        authorName: me.name,
        imageUri: res.assets[0].uri,
      });
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setStoryCreating(false);
    }
  };

  const submitPost = async () => {
    if (!me || posting) return;
    const body = composer.trim();
    if (!body && !imageUri) return;
    setPosting(true);
    try {
      const post = await feedApi.createPost({
        authorId: me.id,
        authorName: me.name,
        content: body,
        imageUri,
        tags,
      });
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      setComposer('');
      setImageUri(null);
      setTags([]);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (post, reaction) => {
    if (!me) return;
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

  const handleShare = async (post) => {
    if (!me || !post?.id) return;
    setSharingId(post.id);
    try {
      await feedApi.sharePost({ post, authorId: me.id, authorName: me.name });
      await load();
      Alert.alert('Амжилттай', 'Постыг хуваалцлаа');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSharingId(null);
    }
  };

  const handleComment = async (post) => {
    const text = (commentDrafts[post.id] || '').trim();
    if (!text || !me) return;
    setCommentingId(post.id);
    try {
      await feedApi.addComment({
        postId: post.id,
        userId: me.id,
        userName: me.name,
        content: text,
        postAuthorId: post.author_id,
      });
      setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setCommentingId(null);
    }
  };

  const handleDelete = (post) => {
    Alert.alert('Пост устгах', 'Энэ постыг устгах уу?', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await feedApi.deletePost(post.id, me.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      },
    ]);
  };

  const onStoryViewed = async (story) => {
    if (!me?.id || story.author_id === me.id) return;
    try {
      await feedApi.markStoryViewed(story.id, me.id);
    } catch (e) {}
  };

  const openProfile = (userId) => navigation.navigate('FeedProfile', { userId });
  const openPost = (post) => navigation.navigate('FeedPost', { postId: post.id });

  const toggleTag = (emp) => {
    setTags((prev) => {
      if (prev.some((t) => t.user_id === emp.id)) {
        return prev.filter((t) => t.user_id !== emp.id);
      }
      return [...prev, { user_id: emp.id, user_name: emp.name }];
    });
  };

  if (!isCloud) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.logo}>gennetex</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Supabase холбогдсон байх шаардлагатай.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Header — Figma Facebook UI */}
      <View style={styles.header}>
        <Text style={styles.logo}>gennetex</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.liveHeaderBtn} onPress={startLive} activeOpacity={0.85}>
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text style={styles.liveHeaderText}>Live</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('FeedSearch')}>
            <Ionicons name="search" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => openProfile(me?.id)}>
            {authProfile?.avatar_url ? (
              <Image source={{ uri: authProfile.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <Ionicons name="person" size={18} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Create post */}
              <View style={styles.createPostCard}>
                <View style={styles.createPostRow}>
                  <Avatar
                    name={me?.name}
                    size={40}
                    uri={authProfile?.avatar_url}
                    onPress={() => openProfile(me?.id)}
                  />
                  <View style={styles.mindField}>
                    <TextInput
                      style={styles.mindInput}
                      placeholder="Та юу бодож байна вэ?"
                      placeholderTextColor={colors.textMuted}
                      value={composer}
                      onChangeText={setComposer}
                      multiline
                    />
                  </View>
                </View>

                {tags.length ? (
                  <View style={styles.selectedTags}>
                    {tags.map((t) => (
                      <TouchableOpacity
                        key={t.user_id}
                        style={styles.selectedTag}
                        onPress={() => setTags((prev) => prev.filter((x) => x.user_id !== t.user_id))}
                      >
                        <Text style={styles.selectedTagText}>@{t.user_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {imageUri ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.previewRemove} onPress={() => setImageUri(null)}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.createDivider} />

                {/* Live / Photo / Tag */}
                <View style={styles.quickActions}>
                  <TouchableOpacity style={styles.quickBtn} onPress={startLive} activeOpacity={0.7}>
                    <Ionicons name="videocam" size={22} color={colors.danger} />
                    <Text style={[styles.quickLabel, styles.liveQuickLabel]}>Live</Text>
                  </TouchableOpacity>
                  <View style={styles.quickSep} />
                  <TouchableOpacity style={styles.quickBtn} onPress={pickImage} activeOpacity={0.7}>
                    <Ionicons name="images" size={20} color={colors.success} />
                    <Text style={styles.quickLabel}>Зураг</Text>
                  </TouchableOpacity>
                  <View style={styles.quickSep} />
                  <TouchableOpacity
                    style={styles.quickBtn}
                    onPress={() => setTagPickerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pricetag" size={18} color={colors.warning} />
                    <Text style={styles.quickLabel}>Tag</Text>
                  </TouchableOpacity>
                </View>

                {(composer.trim() || imageUri) && (
                  <TouchableOpacity
                    style={[styles.publishBtn, posting && { opacity: 0.5 }]}
                    onPress={submitPost}
                    disabled={posting}
                  >
                    {posting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.publishText}>Нийтлэх</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.spacer} />

              {activeMeeting?.id ? (
                <TouchableOpacity style={styles.meetingBanner} activeOpacity={0.9} onPress={joinMeeting}>
                  <View style={styles.meetingBannerLeft}>
                    <View style={styles.meetingPill}>
                      <View style={styles.liveCardDot} />
                      <Text style={styles.meetingPillText}>LIVE</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.meetingTitle} numberOfLines={1}>
                        {activeMeeting.host_name || 'Ажилтан'} live хийж байна
                      </Text>
                      <Text style={styles.meetingSub}>
                        {activeMeeting.host_id === me?.id ? 'Үргэлжлүүлэх' : 'Дарж үзэх'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.meetingJoinBtn}>
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.meetingJoinText}>
                      {activeMeeting.host_id === me?.id ? 'Үргэлжлүүлэх' : 'Үзэх'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {activeMeeting?.id ? <View style={styles.spacer} /> : null}

              <StoriesRow
                me={me}
                authProfile={authProfile}
                storyGroups={storyGroups}
                onCreate={createStory}
                onOpen={setViewerGroup}
                creating={storyCreating}
              />

              <View style={styles.spacer} />
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              me={{ ...me, avatar_url: authProfile?.avatar_url }}
              onReact={handleReact}
              onOpenReactPicker={setPickerPost}
              onShare={handleShare}
              sharing={sharingId === item.id}
              onComment={handleComment}
              onDelete={handleDelete}
              onOpenPost={openPost}
              onOpenProfile={openProfile}
              commentText={commentDrafts[item.id] || ''}
              onChangeComment={(t) => setCommentDrafts((prev) => ({ ...prev, [item.id]: t }))}
              commenting={commentingId === item.id}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.spacer} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <Image source={require('../../assets/logo.png')} style={styles.loadLogo} resizeMode="contain" />
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            )
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      </KeyboardAvoidingView>

      {/* Reaction picker */}
      <Modal visible={!!pickerPost} transparent animationType="fade" onRequestClose={() => setPickerPost(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerPost(null)}>
          <View style={styles.reactPicker}>
            {REACTION_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={styles.reactOption}
                onPress={() => {
                  const post = pickerPost;
                  setPickerPost(null);
                  if (post) handleReact(post, r.key);
                }}
              >
                <Text style={styles.reactOptionEmoji}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Tag picker */}
      <Modal visible={tagPickerOpen} transparent animationType="slide" onRequestClose={() => setTagPickerOpen(false)}>
        <Pressable style={styles.modalBgBottom} onPress={() => setTagPickerOpen(false)}>
          <Pressable style={styles.tagSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.tagSheetTitle}>Tag people</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {employees.map((emp) => {
                const selected = tags.some((t) => t.user_id === emp.id);
                return (
                  <TouchableOpacity key={emp.id} style={styles.tagRow} onPress={() => toggleTag(emp)}>
                    <Avatar name={emp.name} size={40} uri={emp.avatar_url} />
                    <Text style={styles.tagRowName}>{emp.name}</Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.tagDone} onPress={() => setTagPickerOpen(false)}>
              <Text style={styles.tagDoneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {viewerGroup ? (
        <StoryViewer
          group={viewerGroup}
          me={me}
          onClose={() => {
            setViewerGroup(null);
            load();
          }}
          onViewed={onStoryViewed}
        />
      ) : null}

      <LiveStreamModal
        visible={meetingOpen && !!activeMeeting?.id}
        room={activeMeeting?.id ? liveRoomFromId(activeMeeting.id) : ''}
        liveId={activeMeeting?.id}
        name={me?.name}
        userId={me?.id}
        isHost={meetingIsHost}
        hostName={activeMeeting?.host_name}
        employees={employees}
        onClose={closeMeeting}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logo: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  liveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  liveHeaderText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  createPostCard: { backgroundColor: colors.surface, paddingTop: 12 },
  createPostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  mindField: { flex: 1 },
  mindInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  createDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 12,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  quickLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  liveQuickLabel: { color: colors.danger, fontWeight: '800' },
  quickSep: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: colors.border },
  publishBtn: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  publishText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  selectedTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedTagText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  previewWrap: { marginTop: 10, marginHorizontal: 12, position: 'relative' },
  previewImage: { width: '100%', height: 180, borderRadius: 8 },
  previewRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  spacer: { height: 8, backgroundColor: colors.background },

  liveCardDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  meetingBanner: {
    backgroundColor: colors.surface,
    marginHorizontal: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meetingBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  meetingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  meetingPillText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  meetingTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  meetingSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  meetingJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  meetingJoinText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  storiesWrap: { backgroundColor: colors.surface, paddingVertical: 12 },
  storiesScroll: { paddingHorizontal: 12 },
  storyCard: {
    width: STORY_W,
    height: STORY_H,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: colors.surfaceContainerHigh,
  },
  createStoryPhoto: { flex: 1.35, overflow: 'hidden' },
  createStoryImg: { width: '100%', height: '100%' },
  createStoryPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createStoryPlaceholderText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  createStoryFooter: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  createPlus: {
    position: 'absolute',
    top: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createStoryLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  storyImg: { ...StyleSheet.absoluteFillObject },
  storyShade: { ...StyleSheet.absoluteFillObject },
  storyRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingWhite: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingBlue: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    padding: 0,
  },
  storyRingSeen: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 0,
  },
  storyName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },

  postCard: { backgroundColor: colors.surface },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  postHeaderMeta: { flex: 1, minWidth: 0, justifyContent: 'center' },
  postAuthor: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  postTime: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  metaDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.textMuted },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBodyWrap: { paddingBottom: 4 },
  postBody: {
    color: colors.text,
    fontSize: 15.5,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  tagChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  postImage: {
    width: SCREEN_W,
    height: Math.round(SCREEN_W * 0.92),
    backgroundColor: colors.surfaceContainerHigh,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  countsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactBadges: { flexDirection: 'row', alignItems: 'center' },
  reactBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  reactBadgeEmoji: { fontSize: 10, marginTop: Platform.OS === 'ios' ? 0 : -1 },
  countsText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  actionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  actionsDividerTight: { marginTop: 4 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 2 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  actionBtnPressed: { backgroundColor: colors.background },
  actionEmoji: { fontSize: 17 },
  actionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },

  commentsBlock: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  viewMoreComments: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
    paddingBottom: 2,
  },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentAuthor: { color: colors.text, fontWeight: '700', fontSize: 13 },
  commentText: { color: colors.text, fontSize: 14, marginTop: 2, lineHeight: 19 },
  writeCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  writeCommentField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    minHeight: 40,
  },
  writeCommentInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 2,
    marginRight: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.primary, fontWeight: '800' },

  center: { alignItems: 'center', padding: 48 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  loadLogo: { width: 90, height: 70 },
  errorBar: { backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 8 },
  errorText: { color: '#B91C1C', fontSize: 13 },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBgBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  reactPicker: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  reactOption: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  reactOptionEmoji: { fontSize: 32 },

  tagSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  tagSheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  tagRowName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  tagDone: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tagDoneText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  viewer: { flex: 1, backgroundColor: '#000' },
  viewerImage: { width: SCREEN_W, height: SCREEN_H },
  viewerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
    paddingHorizontal: 10,
  },
  viewerBars: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  viewerBarTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  viewerBarFill: { height: '100%', width: 0, backgroundColor: '#fff' },
  viewerBarDone: { width: '100%' },
  viewerBarActive: { width: '100%' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  viewerTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  viewerTouchRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  viewerTouch: { flex: 1 },
});
