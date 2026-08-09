import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

const REACTIONS = ['like', 'love', 'care', 'haha', 'angry'];

export function isValidReaction(r) {
  return REACTIONS.includes(r);
}

async function uploadFeedImage(uri, folder = 'posts') {
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from('feed')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) {
    if (String(error.message).includes('Bucket not found')) {
      throw new Error('Feed storage байхгүй. Supabase дээр migration_feed.sql ажиллуулна уу.');
    }
    throw error;
  }
  const { data } = supabase.storage.from('feed').getPublicUrl(path);
  return data.publicUrl;
}

async function fetchAllUserIds(excludeId) {
  const { data, error } = await supabase.from('profiles').select('id');
  if (error) throw error;
  return (data || []).map((p) => p.id).filter((id) => id && id !== excludeId);
}

function attachMeta(posts, reactions, comments, profilesById = {}) {
  const byPostReact = {};
  const byPostComment = {};
  (reactions || []).forEach((r) => {
    if (!byPostReact[r.post_id]) byPostReact[r.post_id] = [];
    byPostReact[r.post_id].push(r);
  });
  (comments || []).forEach((c) => {
    if (!byPostComment[c.post_id]) byPostComment[c.post_id] = [];
    byPostComment[c.post_id].push(c);
  });
  return (posts || []).map((p) => {
    const reacts = byPostReact[p.id] || [];
    const counts = { like: 0, love: 0, care: 0, haha: 0, angry: 0 };
    reacts.forEach((r) => {
      if (counts[r.reaction] != null) counts[r.reaction] += 1;
    });
    const author = profilesById[p.author_id] || {};
    const postComments = (byPostComment[p.id] || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((c) => ({
        ...c,
        user_avatar_url: profilesById[c.user_id]?.avatar_url || null,
        user_name: c.user_name || profilesById[c.user_id]?.name || 'Ажилтан',
      }));
    return {
      ...p,
      author_name: p.author_name || author.name || 'Ажилтан',
      author_avatar_url: author.avatar_url || null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      reactions: reacts,
      reactionCounts: counts,
      reactionTotal: reacts.length,
      comments: postComments,
      commentCount: postComments.length,
    };
  });
}

async function fetchProfilesMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', ids);
  if (error) return {};
  const map = {};
  (data || []).forEach((p) => {
    map[p.id] = p;
  });
  return map;
}

async function hydratePosts(posts) {
  if (!posts?.length) return [];
  const ids = posts.map((p) => p.id);
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from('post_reactions').select('*').in('post_id', ids),
    supabase.from('post_comments').select('*').in('post_id', ids).order('created_at', { ascending: true }),
  ]);
  const profileIds = [
    ...posts.map((p) => p.author_id),
    ...(comments || []).map((c) => c.user_id),
  ];
  const profilesById = await fetchProfilesMap(profileIds);
  return attachMeta(posts, reactions, comments, profilesById);
}

export async function fetchFeed(limit = 50) {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts(posts);
}

export async function fetchPostsByAuthor(authorId, limit = 50) {
  if (!authorId) return [];
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts(posts);
}

export async function fetchPostById(postId) {
  if (!postId) return null;
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!post) return null;
  const [hydrated] = await hydratePosts([post]);
  return hydrated;
}

export async function searchPosts(query, limit = 40) {
  const q = String(query || '').trim();
  if (!q) return [];
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .or(`content.ilike.%${q}%,author_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts(posts);
}

export async function fetchFeedProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, position, phone, avatar_url, role, email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPost({ authorId, authorName, content, imageUri, tags = [] }) {
  const body = String(content || '').trim();
  if (!body && !imageUri) throw new Error('Пост хоосон байна');

  let imageUrl = null;
  if (imageUri) imageUrl = await uploadFeedImage(imageUri);

  const cleanTags = (tags || [])
    .filter((t) => t?.user_id && t?.user_name)
    .map((t) => ({ user_id: t.user_id, user_name: t.user_name }));

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      author_name: authorName,
      content: body,
      image_url: imageUrl,
      tags: cleanTags,
    })
    .select()
    .single();
  if (error) {
    if (String(error.message).includes('posts') && String(error.message).includes('schema cache')) {
      throw new Error('Пост хүснэгт байхгүй. Supabase дээр migration_feed.sql ажиллуулна уу.');
    }
    throw error;
  }

  try {
    const recipients = await fetchAllUserIds(authorId);
    await notifyApi.notifyUsers(recipients, {
      title: `${authorName || 'Ажилтан'} шинэ пост тавилаа`,
      body: body || 'Зурагтай пост',
      data: { type: 'feed', postId: data.id },
      channelId: 'feed',
      priority: 'high',
    });
    const taggedIds = cleanTags.map((t) => t.user_id).filter((id) => id !== authorId);
    if (taggedIds.length) {
      await notifyApi.notifyUsers(taggedIds, {
        title: `${authorName || 'Ажилтан'} таныг tag хийлээ`,
        body: body || 'Пост дээр tag хийгдлээ',
        data: { type: 'feed', postId: data.id },
        channelId: 'feed',
        priority: 'high',
      });
    }
  } catch (e) {}

  const profiles = await fetchProfilesMap([authorId]);
  const author = profiles[authorId] || {};

  return {
    ...data,
    author_name: data.author_name || author.name || authorName,
    author_avatar_url: author.avatar_url || null,
    tags: cleanTags,
    reactions: [],
    reactionCounts: { like: 0, love: 0, care: 0, haha: 0, angry: 0 },
    reactionTotal: 0,
    comments: [],
    commentCount: 0,
  };
}

export async function deletePost(postId, userId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', userId);
  if (error) throw error;
}

/** Постыг feed дээр хуваалцах (share) */
export async function sharePost({ post, authorId, authorName }) {
  if (!post?.id || !authorId) throw new Error('Пост олдсонгүй');
  const originalAuthor = post.author_name || 'Ажилтан';
  const header = `🔄 ${originalAuthor}-ийн постыг хуваалцлаа`;
  const body = post.content ? `${header}\n\n${post.content}` : header;

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      author_name: authorName,
      content: body,
      image_url: post.image_url || null,
      tags: [],
    })
    .select()
    .single();
  if (error) throw error;

  try {
    const recipients = await fetchAllUserIds(authorId);
    await notifyApi.notifyUsers(recipients, {
      title: `${authorName || 'Ажилтан'} пост хуваалцлаа`,
      body: post.content || `${originalAuthor}-ийн пост`,
      data: { type: 'feed', postId: data.id },
      channelId: 'feed',
      priority: 'default',
    });
  } catch (e) {}

  const profiles = await fetchProfilesMap([authorId]);
  const author = profiles[authorId] || {};
  return {
    ...data,
    author_name: data.author_name || author.name || authorName,
    author_avatar_url: author.avatar_url || null,
    tags: [],
    reactions: [],
    reactionCounts: { like: 0, love: 0, care: 0, haha: 0, angry: 0 },
    reactionTotal: 0,
    comments: [],
    commentCount: 0,
  };
}

export async function setReaction({ postId, userId, userName, reaction, postAuthorId, postAuthorName }) {
  if (!isValidReaction(reaction)) throw new Error('Буруу reaction');

  const { data: existing } = await supabase
    .from('post_reactions')
    .select('id, reaction')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    const { error } = await supabase.from('post_reactions').delete().eq('id', existing.id);
    if (error) throw error;
    return null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from('post_reactions')
      .update({ reaction, user_name: userName })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('post_reactions')
    .insert({
      post_id: postId,
      user_id: userId,
      user_name: userName,
      reaction,
    })
    .select()
    .single();
  if (error) throw error;

  if (postAuthorId && postAuthorId !== userId) {
    try {
      await notifyApi.notifyUsers([postAuthorId], {
        title: `${userName || 'Ажилтан'} таны постад reaction дарлаа`,
        body: reactionLabel(reaction),
        data: { type: 'feed', postId },
        channelId: 'feed',
        priority: 'default',
      });
    } catch (e) {}
  }

  return data;
}

export async function addComment({ postId, userId, userName, content, postAuthorId }) {
  const body = String(content || '').trim();
  if (!body) throw new Error('Сэтгэгдэл хоосон байна');

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      user_name: userName,
      content: body,
    })
    .select()
    .single();
  if (error) throw error;

  if (postAuthorId && postAuthorId !== userId) {
    try {
      await notifyApi.notifyUsers([postAuthorId], {
        title: `${userName || 'Ажилтан'} сэтгэгдэл бичлээ`,
        body,
        data: { type: 'feed', postId },
        channelId: 'feed',
        priority: 'high',
      });
    } catch (e) {}
  }

  return data;
}

export async function deleteComment(commentId, userId) {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export function reactionLabel(reaction) {
  const map = {
    like: '👍 Like',
    love: '❤️ Love',
    care: '🤗 Care',
    haha: '😆 Haha',
    angry: '😠 Angry',
  };
  return map[reaction] || reaction;
}

export function reactionEmoji(reaction) {
  const map = {
    like: '👍',
    love: '❤️',
    care: '🤗',
    haha: '😆',
    angry: '😠',
  };
  return map[reaction] || '👍';
}

/** Story-уудыг author-оор бүлэглэж, 24 цагийн доторхыг буцаана */
export async function fetchStories(viewerId) {
  const now = new Date().toISOString();
  const { data: stories, error } = await supabase
    .from('stories')
    .select('*')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!stories?.length) return [];

  const ids = stories.map((s) => s.id);
  const { data: views } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('user_id', viewerId)
    .in('story_id', ids);
  const seen = new Set((views || []).map((v) => v.story_id));
  const profilesById = await fetchProfilesMap(stories.map((s) => s.author_id));

  const byAuthor = new Map();
  stories.forEach((s) => {
    if (!byAuthor.has(s.author_id)) {
      const profile = profilesById[s.author_id] || {};
      byAuthor.set(s.author_id, {
        author_id: s.author_id,
        author_name: s.author_name || profile.name,
        author_avatar_url: profile.avatar_url || null,
        stories: [],
        hasUnseen: false,
        latestAt: s.created_at,
        coverUrl: s.image_url,
      });
    }
    const group = byAuthor.get(s.author_id);
    group.stories.push({ ...s, seen: seen.has(s.id) });
    if (!seen.has(s.id) && s.author_id !== viewerId) group.hasUnseen = true;
  });

  // тус бүрийн story-г хуучин → шинэ дарааллаар (viewer-д зүүнээс баруун)
  const groups = [...byAuthor.values()].map((g) => ({
    ...g,
    stories: g.stories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    coverUrl: g.stories[g.stories.length - 1]?.image_url || g.coverUrl,
  }));

  // миний story эхэнд, дараа нь unseen, дараа нь бусад
  groups.sort((a, b) => {
    if (a.author_id === viewerId) return -1;
    if (b.author_id === viewerId) return 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return new Date(b.latestAt) - new Date(a.latestAt);
  });

  return groups;
}

export async function createStory({ authorId, authorName, imageUri }) {
  if (!imageUri) throw new Error('Story зураг сонгоно уу');
  const imageUrl = await uploadFeedImage(imageUri, 'stories');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: authorId,
      author_name: authorName,
      image_url: imageUrl,
      expires_at: expires,
    })
    .select()
    .single();
  if (error) {
    if (String(error.message).includes('stories')) {
      throw new Error('Story хүснэгт байхгүй. Supabase дээр migration_feed.sql ажиллуулна уу.');
    }
    throw error;
  }

  try {
    const recipients = await fetchAllUserIds(authorId);
    await notifyApi.notifyUsers(recipients, {
      title: `${authorName || 'Ажилтан'} story нэмлээ`,
      body: 'Story үзэх',
      data: { type: 'feed', storyId: data.id },
      channelId: 'feed',
      priority: 'high',
    });
  } catch (e) {}

  return data;
}

export async function markStoryViewed(storyId, userId) {
  if (!storyId || !userId) return;
  await supabase
    .from('story_views')
    .upsert({ story_id: storyId, user_id: userId }, { onConflict: 'story_id,user_id' });
}

export function subscribeFeed({ onPost, onReaction, onComment, onStory }) {
  const channel = supabase
    .channel('feed-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
      onPost?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, (payload) => {
      onReaction?.(payload);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
      onComment?.(payload.new);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
      onPost?.({ ...payload.old, _deleted: true });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, (payload) => {
      onStory?.(payload.new);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}
