import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as feedApi from '../services/feedService';
import { formatRelativeTime } from '../lib/formatTime';
import { ERP_NOT_FOUND } from '../lib/erpMessages';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function FeedSearchScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { fetchEmployees, currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees()
      .then((list) => setAllPeople(list || []))
      .catch(() => setAllPeople([]));
  }, [fetchEmployees]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setPosts([]);
      setPeople([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [postList] = await Promise.all([feedApi.searchPosts(q)]);
        if (!active) return;
        setPosts(postList);
        const lower = q.toLowerCase();
        setPeople(
          allPeople.filter(
            (p) =>
              p.id !== currentUser?.id &&
              (p.name?.toLowerCase().includes(lower) ||
                p.position?.toLowerCase().includes(lower) ||
                p.phone?.includes(q))
          )
        );
      } catch (e) {
        if (active) {
          setPosts([]);
          setPeople([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 280);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, allPeople, currentUser?.id]);

  const showPeople = tab === 'all' || tab === 'people';
  const showPosts = tab === 'all' || tab === 'posts';

  const data = [];
  if (showPeople && people.length) {
    data.push({ type: 'header', id: 'h-people', title: 'Хүмүүс' });
    people.forEach((p) => data.push({ type: 'person', id: `p-${p.id}`, person: p }));
  }
  if (showPosts && posts.length) {
    data.push({ type: 'header', id: 'h-posts', title: 'Постууд' });
    posts.forEach((p) => data.push({ type: 'post', id: `post-${p.id}`, post: p }));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Хүн, пост хайх..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'all', label: 'Бүгд' },
          { key: 'people', label: 'Хүмүүс' },
          { key: 'posts', label: 'Пост' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {query.trim() ? ERP_NOT_FOUND : 'Хайх үгээ бичнэ үү'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.section}>{item.title}</Text>;
            }
            if (item.type === 'person') {
              const p = item.person;
              return (
                <TouchableOpacity
                  style={styles.personRow}
                  onPress={() => navigation.navigate('FeedProfile', { userId: p.id })}
                >
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{initials(p.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{p.name}</Text>
                    <Text style={styles.personSub}>{p.position || 'Ажилтан'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              );
            }
            const post = item.post;
            return (
              <TouchableOpacity
                style={styles.postRow}
                onPress={() => navigation.navigate('FeedPost', { postId: post.id })}
              >
                <Text style={styles.postAuthor}>{post.author_name}</Text>
                <Text style={styles.postTime}>{formatRelativeTime(post.created_at)}</Text>
                <Text style={styles.postContent} numberOfLines={3}>
                  {post.content || 'Зурагтай пост'}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.primary },
  section: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  personName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  personSub: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  postRow: {
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 8,
  },
  postAuthor: { color: colors.text, fontWeight: '700', fontSize: 15 },
  postTime: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  postContent: { color: colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 },
  center: { alignItems: 'center', padding: 40 },
  empty: { color: colors.textMuted, fontSize: 15 },
  logo: { width: 90, height: 70 },
});
