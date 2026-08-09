import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as feedApi from '../services/feedService';
import { uploadAvatar } from '../services/attendanceService';
import { formatRelativeTime } from '../lib/formatTime';

const { width: SCREEN_W } = Dimensions.get('window');

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

function reactionSummary(counts = {}) {
  const map = [
    ['like', '👍'],
    ['love', '❤️'],
    ['care', '🤗'],
    ['haha', '😆'],
    ['angry', '😠'],
  ];
  return map.filter(([k]) => counts[k] > 0).map(([, e]) => e);
}

export default function FeedProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { userId } = route.params || {};
  const { authProfile, currentUser, updateMyProfile, isCloud } = useApp();

  const profileId = userId || currentUser?.id;
  const isOwn = profileId === currentUser?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', position: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud || !profileId) return;
    setLoading(true);
    try {
      const [p, list] = await Promise.all([
        feedApi.fetchFeedProfile(profileId),
        feedApi.fetchPostsByAuthor(profileId),
      ]);
      setProfile(p);
      setPosts(list);
      if (p) setForm({ name: p.name || '', position: p.position || '', phone: p.phone || '' });
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  }, [isCloud, profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changeAvatar = () => {
    if (!isOwn) return;
    Alert.alert('Профайл зураг', 'Зургаа хаанаас сонгох вэ?', [
      {
        text: 'Зургийн сан',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.65,
          });
          if (res.canceled) return;
          setUploading(true);
          try {
            const url = await uploadAvatar(res.assets[0].uri, profileId);
            await updateMyProfile({ avatar_url: url });
            await load();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          } finally {
            setUploading(false);
          }
        },
      },
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
      });
      setEditOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  const name = profile?.name || (isOwn ? authProfile?.name : 'Ажилтан');
  const avatarUrl = profile?.avatar_url || (isOwn ? authProfile?.avatar_url : null);
  const totalReactions = posts.reduce((sum, p) => sum + (p.reactionTotal || 0), 0);

  const renderPost = ({ item }) => {
    const emojis = reactionSummary(item.reactionCounts);
    const previewComments = (item.comments || []).slice(-2);
    return (
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.92}
        onPress={() => navigation.navigate('FeedPost', { postId: item.id })}
      >
        <View style={styles.postHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.postAvatar} />
          ) : (
            <View style={[styles.postAvatar, styles.postAvatarFallback]}>
              <Text style={styles.postAvatarText}>{initials(name)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>{name}</Text>
            <View style={styles.postTimeRow}>
              <Text style={styles.postTime}>{formatRelativeTime(item.created_at)}</Text>
              <Text style={styles.postDot}>·</Text>
              <Ionicons name="earth" size={12} color={colors.textMuted} />
            </View>
          </View>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </View>

        {item.content ? (
          <Text style={styles.postContent} numberOfLines={5}>{item.content}</Text>
        ) : null}
        {item.tags?.length ? (
          <Text style={styles.tagsLine} numberOfLines={1}>
            {item.tags.map((t) => `@${t.user_name}`).join(' ')}
          </Text>
        ) : null}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postImage} />
        ) : null}

        {(item.reactionTotal > 0 || item.commentCount > 0) && (
          <View style={styles.postStats}>
            <View style={styles.statsLeft}>
              {emojis.length ? <Text style={styles.statsEmojis}>{emojis.join('')}</Text> : null}
              {item.reactionTotal > 0 ? (
                <Text style={styles.statText}>{item.reactionTotal}</Text>
              ) : null}
            </View>
            {item.commentCount > 0 ? (
              <Text style={styles.statText}>{item.commentCount} сэтгэгдэл</Text>
            ) : null}
          </View>
        )}

        {previewComments.length ? (
          <View style={styles.previewComments}>
            {item.commentCount > 2 ? (
              <Text style={styles.viewAll}>Бүх сэтгэгдэл харах ({item.commentCount})</Text>
            ) : null}
            {previewComments.map((c) => (
              <View key={c.id} style={styles.previewCommentRow}>
                <View style={styles.previewCommentAvatar}>
                  <Text style={styles.previewCommentAvatarText}>{initials(c.user_name)}</Text>
                </View>
                <View style={styles.previewCommentBubble}>
                  <Text style={styles.previewCommentAuthor}>{c.user_name}</Text>
                  <Text style={styles.previewCommentText} numberOfLines={2}>{c.content}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.topSub}>{posts.length} пост</Text>
        </View>
        {isOwn ? (
          <TouchableOpacity onPress={() => setEditOpen(true)} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <Image source={require('../../assets/logo.png')} style={styles.loadLogo} resizeMode="contain" />
          <Text style={styles.loadBrand}>gennetex</Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 48 }}
          ListHeaderComponent={
            <View>
              <View style={styles.heroCard}>
                <LinearGradient
                  colors={['#0866FF', '#4B8BFF', '#A7C7FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cover}
                >
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.coverLogo}
                    resizeMode="contain"
                  />
                </LinearGradient>

                <View style={styles.avatarRow}>
                  <TouchableOpacity
                    style={styles.avatarWrap}
                    onPress={changeAvatar}
                    activeOpacity={isOwn ? 0.85 : 1}
                    disabled={!isOwn || uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <LinearGradient colors={['#E7F3FF', '#D0E7FF']} style={styles.avatarFallback}>
                        <Text style={styles.avatarLetter}>{initials(name)}</Text>
                      </LinearGradient>
                    )}
                    {isOwn ? (
                      <View style={styles.camBadge}>
                        <Ionicons name="camera" size={14} color="#fff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </View>

                <View style={styles.identity}>
                  <Text style={styles.name}>{name}</Text>
                  {profile?.position ? (
                    <Text style={styles.position}>{profile.position}</Text>
                  ) : (
                    <Text style={styles.position}>Gennetex ажилтан</Text>
                  )}
                  {profile?.phone ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.meta}>{profile.phone}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.statsBar}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>{posts.length}</Text>
                    <Text style={styles.statLabel}>Пост</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>{totalReactions}</Text>
                    <Text style={styles.statLabel}>Reaction</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNum}>
                      {posts.reduce((s, p) => s + (p.commentCount || 0), 0)}
                    </Text>
                    <Text style={styles.statLabel}>Сэтгэгдэл</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {isOwn ? (
                    <>
                      <TouchableOpacity style={styles.primaryBtn} onPress={() => setEditOpen(true)}>
                        <Ionicons name="pencil" size={16} color="#fff" />
                        <Text style={styles.primaryBtnText}>Профайл засах</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryBtn} onPress={changeAvatar}>
                        <Ionicons name="camera-outline" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => navigation.navigate('MainTabs', { screen: 'Chat' })}
                    >
                      <Ionicons name="chatbubble" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Мессеж</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Постууд</Text>
                  <View style={styles.sectionPill}>
                    <Text style={styles.sectionPillText}>{posts.length}</Text>
                  </View>
                </View>
                <Text style={styles.sectionHint}>
                  {isOwn ? 'Таны нийтэлсэн постууд' : `${name}-ийн нийтэлсэн постууд`}
                </Text>
              </View>
            </View>
          }
          renderItem={renderPost}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="newspaper-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>Пост алга</Text>
              <Text style={styles.emptySub}>
                {isOwn ? 'Эхний постыг gennetex дээр тавина уу' : 'Энэ ажилтан пост тавиагүй байна'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setEditOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Профайл засах</Text>
            <Text style={styles.label}>Нэр</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            <Text style={styles.label}>Албан тушаал</Text>
            <TextInput style={styles.input} value={form.position} onChangeText={(t) => setForm({ ...form, position: t })} />
            <Text style={styles.label}>Утас</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
              keyboardType="phone-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditOpen(false)}>
                <Text style={styles.cancelText}>Болих</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Хадгалах</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  topSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  heroCard: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    paddingBottom: 14,
  },
  cover: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLogo: { width: 72, height: 56, opacity: 0.35 },
  avatarRow: {
    paddingHorizontal: 14,
    marginTop: -52,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 42, fontWeight: '800', color: colors.primary },
  camBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  identity: { paddingHorizontal: 16, marginTop: 10 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text },
  position: { marginTop: 4, fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { color: colors.textMuted, fontSize: 14 },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginHorizontal: 14,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    width: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionPill: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionPillText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  sectionHint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },

  postCard: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    paddingTop: 12,
    paddingBottom: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  postAuthor: { color: colors.text, fontWeight: '700', fontSize: 15 },
  postTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  postTime: { color: colors.textMuted, fontSize: 12 },
  postDot: { color: colors.textMuted },
  postContent: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  tagsLine: { color: colors.primary, fontSize: 14, marginTop: 6, fontWeight: '600', paddingHorizontal: 12 },
  postImage: {
    width: '100%',
    height: SCREEN_W * 0.7,
    marginTop: 10,
    backgroundColor: colors.surfaceContainerHigh,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsEmojis: { fontSize: 14 },
  statText: { color: colors.textMuted, fontSize: 13 },
  previewComments: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  viewAll: { color: colors.textMuted, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  previewCommentRow: { flexDirection: 'row', gap: 8 },
  previewCommentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCommentAvatarText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  previewCommentBubble: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewCommentAuthor: { color: colors.text, fontWeight: '700', fontSize: 12 },
  previewCommentText: { color: colors.text, fontSize: 13, marginTop: 1 },

  emptyCard: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  center: { alignItems: 'center', padding: 40 },
  loadLogo: { width: 100, height: 80 },
  loadBrand: { color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: 4 },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 30,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 4, marginTop: 8, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: colors.text, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
