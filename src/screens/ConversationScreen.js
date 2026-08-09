import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import VideoCallModal from '../components/VideoCallModal';
import CallScreen from '../components/CallScreen';
import ActiveTripsBanner from '../components/ActiveTripsBanner';
import * as chatApi from '../services/chatService';
import * as callApi from '../services/callService';
import VoiceMessageButton from '../components/VoiceMessageButton';
import ChatImagePreview from '../components/ChatImagePreview';
import ChatVideoPreview from '../components/ChatVideoPreview';
import { setActiveChatRoom } from '../lib/chatFocus';
import { formatTime, formatChatDay, isSameChatDay } from '../lib/formatTime';
import { isOnline, formatLastSeen } from '../lib/online';

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

const IMAGE_MAX_W = 240;
const IMAGE_MAX_H = 320;

function ChatImage({ uri, onPress }) {
  const styles = useStyles(makeStyles);
  const [size, setSize] = useState({ width: IMAGE_MAX_W, height: IMAGE_MAX_W * 0.75 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    Image.getSize(
      uri,
      (w, h) => {
        if (!active || !w || !h) return;
        let width = w;
        let height = h;
        if (width > IMAGE_MAX_W) {
          height = (IMAGE_MAX_W / width) * height;
          width = IMAGE_MAX_W;
        }
        if (height > IMAGE_MAX_H) {
          width = (IMAGE_MAX_H / height) * width;
          height = IMAGE_MAX_H;
        }
        setSize({ width: Math.round(width), height: Math.round(height) });
      },
      () => {
        if (active) setSize({ width: IMAGE_MAX_W, height: IMAGE_MAX_W * 0.75 });
      }
    );
    return () => {
      active = false;
    };
  }, [uri]);

  if (failed) {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(uri)} style={styles.mediaFallback}>
        <Text style={styles.mediaFallbackText}>Зураг нээх</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
      <Image
        source={{ uri }}
        style={[styles.msgImage, { width: size.width, height: size.height }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
}

const VIDEO_THUMB_W = 220;
const VIDEO_THUMB_H = 124;

function ChatVideo({ onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.videoThumb}>
      <View style={styles.videoPlayCircle}>
        <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
      </View>
    </TouchableOpacity>
  );
}

function MessageTime({ time, edited, mine, overlay }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.timeRow, overlay && styles.timeRowOverlay]}>
      {edited ? <Text style={[styles.timeText, mine && styles.timeTextMine, overlay && styles.timeTextOverlay]}>зассан </Text> : null}
      <Text style={[styles.timeText, mine && styles.timeTextMine, overlay && styles.timeTextOverlay]}>{time}</Text>
      {mine ? (
        <Ionicons
          name="checkmark-done"
          size={14}
          color={overlay ? '#fff' : colors.onPrimaryContainer}
          style={styles.checkIcon}
        />
      ) : null}
    </View>
  );
}

export default function ConversationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { conversationId, title, isGroup, otherUser, memberCount, groupAvatarUrl: initialGroupAvatar } = route.params || {};
  const { currentUser, isCloud } = useApp();
  const me = currentUser;
  const room = conversationId;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [callVisible, setCallVisible] = useState(false);
  const [outgoing, setOutgoing] = useState(null);
  const outgoingUnsub = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voicePreview, setVoicePreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [groupAvatarUrl, setGroupAvatarUrl] = useState(initialGroupAvatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const listRef = useRef(null);

  const peerOnline = !isGroup && otherUser?.last_seen ? isOnline(otherUser.last_seen) : false;
  const headerSubtitle = isGroup
    ? `${memberCount || 0} гишүүн`
    : peerOnline
    ? 'онлайн'
    : otherUser?.last_seen
    ? formatLastSeen(otherUser.last_seen)
    : 'хувийн чат';

  const load = useCallback(async () => {
    if (!isCloud || !room) return;
    try {
      setMessages(await chatApi.fetchMessages(room));
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, room]);

  useEffect(() => {
    setActiveChatRoom(room);
    return () => setActiveChatRoom(null);
  }, [room]);

  useEffect(() => {
    load();
    if (!isCloud || !room) return;
    const unsub = chatApi.subscribeMessages(room, {
      onInsert: (msg) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      },
      onUpdate: (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      },
      onDelete: (msg) => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      },
    });
    return unsub;
  }, [load, isCloud, room]);

  useEffect(() => {
    if (!isGroup || !isCloud || !room) return;
    let active = true;
    chatApi.fetchConversation(room).then((conv) => {
      if (active && conv?.avatar_url) setGroupAvatarUrl(conv.avatar_url);
    });
    return () => {
      active = false;
    };
  }, [isGroup, isCloud, room]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = useCallback(
    async (content) => {
      const body = (typeof content === 'string' ? content : text).trim();
      if (!body || !me) return;
      if (editingId) {
        setText('');
        setEditingId(null);
        try {
          const updated = await chatApi.updateMessage(editingId, me.id, body);
          setMessages((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
        } catch (e) {
          setError(e.message);
          Alert.alert('Алдаа', e.message);
        }
        return;
      }
      setText('');
      try {
        await chatApi.sendMessage({ room, senderId: me.id, senderName: me.name, content: body });
      } catch (e) {
        setError(e.message);
      }
    },
    [text, me, room, editingId]
  );

  const startEdit = useCallback((item) => {
    if (!item.content) return;
    setEditingId(item.id);
    setText(item.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setText('');
  }, []);

  const confirmDelete = useCallback(
    (item) => {
      Alert.alert('Устгах уу?', 'Энэ мессежийг бүрмөсөн устгах уу?', [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatApi.deleteMessage(item.id, me.id);
              setMessages((prev) => prev.filter((m) => m.id !== item.id));
              if (editingId === item.id) cancelEdit();
            } catch (e) {
              setError(e.message);
              Alert.alert('Алдаа', e.message);
            }
          },
        },
      ]);
    },
    [me, editingId, cancelEdit]
  );

  const openMessageActions = useCallback(
    (item) => {
      if (item.sender_id !== me?.id) return;
      const options = [];
      if (item.content) {
        options.push({ text: 'Засах', onPress: () => startEdit(item) });
      }
      options.push({ text: 'Устгах', style: 'destructive', onPress: () => confirmDelete(item) });
      options.push({ text: 'Болих', style: 'cancel' });
      Alert.alert('Мессеж', 'Юу хийх вэ?', options);
    },
    [me, startEdit, confirmDelete]
  );

  const sendVoiceText = useCallback(
    async (spoken) => {
      const body = spoken?.trim();
      if (!body || !me) return;
      setVoicePreview('');
      try {
        await chatApi.sendMessage({ room, senderId: me.id, senderName: me.name, content: body });
      } catch (e) {
        setError(e.message);
        Alert.alert('Алдаа', e.message);
      }
    },
    [me, room]
  );

  const sendAttachment = async ({ uri, type, mimeType, name }) => {
    if (!me || !room) return;
    setUploading(true);
    try {
      const url = await chatApi.uploadChatFile(uri, { room, mimeType, name });
      await chatApi.sendMessage({
        room,
        senderId: me.id,
        senderName: me.name,
        content: '',
        attachmentUrl: url,
        attachmentType: type,
        attachmentName: name,
      });
    } catch (e) {
      setError(e.message);
      Alert.alert('Алдаа', e.message);
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled) {
      const a = res.assets[0];
      sendAttachment({ uri: a.uri, type: 'image', mimeType: a.mimeType || 'image/jpeg', name: a.fileName || 'image.jpg' });
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.length) {
      const a = res.assets[0];
      sendAttachment({ uri: a.uri, type: 'file', mimeType: a.mimeType, name: a.name });
    }
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Видео сонгоход зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 120,
      quality: 0.7,
    });
    if (!res.canceled) {
      const a = res.assets[0];
      sendAttachment({
        uri: a.uri,
        type: 'video',
        mimeType: a.mimeType || 'video/mp4',
        name: a.fileName || `video_${Date.now()}.mp4`,
      });
    }
  };

  const chooseAttachment = () => {
    Alert.alert('Хавсаргах', 'Юу илгээх вэ?', [
      { text: 'Зураг', onPress: pickImage },
      { text: 'Видео', onPress: pickVideo },
      { text: 'Файл', onPress: pickFile },
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  const handleCall = async () => {
    if (isGroup) {
      setCallVisible(true);
      await send('Групп видео дуудлага эхэллээ.');
      return;
    }
    if (!otherUser?.id) {
      Alert.alert('Дуудлага', 'Хэн рүү залгахаа олсонгүй.');
      return;
    }
    try {
      const call = await callApi.startCall({
        room,
        caller: { id: me.id, name: me.name },
        callee: { id: otherUser.id, name: otherUser.name },
      });
      setOutgoing(call);
      await send('Видео дуудлага руу залгаж байна...');
      if (call?.id) {
        outgoingUnsub.current = callApi.subscribeCallUpdates(call.id, (updated) => {
          if (updated.status === 'accepted') {
            cleanupOutgoing();
            setOutgoing(null);
            setCallVisible(true);
          } else if (updated.status === 'declined' || updated.status === 'ended') {
            cleanupOutgoing();
            setOutgoing(null);
            Alert.alert('Дуудлага', 'Хэрэглэгч татгалзлаа.');
          }
        });
      }
    } catch (e) {
      setOutgoing(null);
      Alert.alert('Дуудлага', e.message || 'Залгахад алдаа гарлаа');
    }
  };

  const cleanupOutgoing = () => {
    if (outgoingUnsub.current) {
      outgoingUnsub.current();
      outgoingUnsub.current = null;
    }
  };

  const cancelOutgoing = async () => {
    cleanupOutgoing();
    if (outgoing?.id) {
      try {
        await callApi.setCallStatus(outgoing.id, 'ended');
      } catch (e) {}
    }
    setOutgoing(null);
  };

  useEffect(() => () => cleanupOutgoing(), []);

  const changeGroupAvatar = () => {
    if (!isGroup || !room) return;
    Alert.alert('Группын зураг', 'Зураг сонгох арга', [
      { text: 'Цуцлах', style: 'cancel' },
      { text: 'Зургийн сан', onPress: pickGroupAvatarFromLibrary },
      { text: 'Камер', onPress: takeGroupAvatarPhoto },
    ]);
  };

  const applyGroupAvatar = async (uri) => {
    if (!uri || !room) return;
    setUploadingAvatar(true);
    try {
      const url = await chatApi.uploadGroupAvatar(uri, room);
      await chatApi.updateConversation(room, { avatar_url: url });
      setGroupAvatarUrl(url);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickGroupAvatarFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
    });
    if (!res.canceled) applyGroupAvatar(res.assets[0].uri);
  };

  const takeGroupAvatarPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камерт хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
    });
    if (!res.canceled) applyGroupAvatar(res.assets[0].uri);
  };

  const displayName = title || 'Чат';
  const headerAvatarUri = isGroup ? groupAvatarUrl : otherUser?.avatar_url;
  const headerAvatarBg = avatarColor(displayName);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable style={styles.headerBack} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>

          <TouchableOpacity
            style={styles.headerIdentity}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('ChatShared', {
                conversationId: room,
                title: displayName,
              })
            }
            onLongPress={isGroup ? changeGroupAvatar : undefined}
          >
            <View style={[styles.headerAvatar, { backgroundColor: headerAvatarBg }]}>
              {uploadingAvatar ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : headerAvatarUri ? (
                <Image source={{ uri: headerAvatarUri }} style={styles.headerAvatarImg} />
              ) : (
                <Text style={styles.headerAvatarText}>{initials(displayName)}</Text>
              )}
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
              <Text style={[styles.headerSub, peerOnline && styles.headerSubOnline]} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() =>
                navigation.navigate('ChatShared', {
                  conversationId: room,
                  title: displayName,
                })
              }
              hitSlop={8}
            >
              <Ionicons name="folder-outline" size={22} color="#fff" />
            </Pressable>
            {isGroup ? (
              <Pressable
                style={styles.headerIconBtn}
                onPress={() => navigation.navigate('AddGroupMembers', { conversationId: room, title })}
                hitSlop={8}
              >
                <Ionicons name="person-add-outline" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable style={styles.headerIconBtn} onPress={handleCall} hitSlop={8}>
              <Ionicons name="videocam" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {isGroup ? <ActiveTripsBanner /> : null}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.chatBg}
          contentContainerStyle={[styles.messageList, !messages.length && styles.messageListEmpty]}
          renderItem={({ item, index }) => {
            const mine = item.sender_id === me?.id;
            const hasImage = item.attachment_type === 'image' && item.attachment_url;
            const hasVideo = item.attachment_type === 'video' && item.attachment_url;
            const hasFile = item.attachment_type === 'file' && item.attachment_url;
            const mediaOnly = (hasImage || hasVideo) && !item.content && !hasFile;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const showDate = !prev || !isSameChatDay(prev.created_at, item.created_at);
            const sameSenderAsPrev = prev && prev.sender_id === item.sender_id && !showDate;
            const sameSenderAsNext = next && next.sender_id === item.sender_id && isSameChatDay(next.created_at, item.created_at);
            const showAvatar = !mine && isGroup && !sameSenderAsNext;
            const showSender = !mine && isGroup && !sameSenderAsPrev;

            return (
              <View>
                {showDate ? (
                  <View style={styles.dateChipWrap}>
                    <View style={styles.dateChip}>
                      <Text style={styles.dateChipText}>{formatChatDay(item.created_at)}</Text>
                    </View>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubbleRow,
                    mine ? styles.rowMine : styles.rowOther,
                    sameSenderAsPrev ? styles.bubbleRowTight : null,
                  ]}
                >
                  {!mine && isGroup ? (
                    showAvatar ? (
                      <View style={[styles.msgAvatar, { backgroundColor: avatarColor(item.sender_name) }]}>
                        <Text style={styles.msgAvatarText}>{initials(item.sender_name)}</Text>
                      </View>
                    ) : (
                      <View style={styles.msgAvatarSpacer} />
                    )
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      const m = String(item.content || '').match(/#meeting:([a-f0-9-]{36})/i);
                      if (m?.[1]) {
                        navigation.navigate('Meeting', {
                          openMeetingId: m[1],
                          openMeetingHost: item.sender_name,
                          openMeetingHostId: item.sender_id,
                        });
                      }
                    }}
                    onLongPress={mine ? () => openMessageActions(item) : undefined}
                    delayLongPress={400}
                    style={styles.bubbleTouch}
                  >
                    <View
                      style={[
                        styles.bubble,
                        mediaOnly ? styles.bubbleMedia : mine ? styles.bubbleMine : styles.bubbleOther,
                        mine && !sameSenderAsNext && styles.bubbleMineTail,
                        !mine && !sameSenderAsNext && styles.bubbleOtherTail,
                      ]}
                    >
                      {showSender ? (
                        <Text
                          style={[
                            styles.sender,
                            { color: avatarColor(item.sender_name) },
                            mediaOnly && styles.senderOnMedia,
                          ]}
                        >
                          {item.sender_name}
                        </Text>
                      ) : null}
                      {hasImage ? (
                        <View style={styles.mediaWrap}>
                          <ChatImage uri={item.attachment_url} onPress={() => setPreviewImage(item.attachment_url)} />
                          {mediaOnly ? (
                            <MessageTime
                              time={formatTime(item.created_at)}
                              edited={!!item.edited_at}
                              mine={mine}
                              overlay
                            />
                          ) : null}
                        </View>
                      ) : null}
                      {hasVideo ? (
                        <View style={styles.mediaWrap}>
                          <ChatVideo onPress={() => setPreviewVideo(item.attachment_url)} />
                          {mediaOnly ? (
                            <MessageTime
                              time={formatTime(item.created_at)}
                              edited={!!item.edited_at}
                              mine={mine}
                              overlay
                            />
                          ) : null}
                        </View>
                      ) : null}
                      {hasFile ? (
                        <TouchableOpacity
                          style={[styles.fileChip, mine && styles.fileChipMine]}
                          onPress={() => Linking.openURL(item.attachment_url)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.fileIconWrap, mine && styles.fileIconWrapMine]}>
                            <Ionicons name="document" size={20} color="#fff" />
                          </View>
                          <View style={styles.fileMeta}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {item.attachment_name || 'Файл'}
                            </Text>
                            <Text style={styles.fileSub}>Файл</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                      {item.content ? (
                        <View style={styles.msgContentWrap}>
                          <Text style={[styles.msgText, mine && styles.msgTextMine]}>{item.content}</Text>
                          <MessageTime
                            time={formatTime(item.created_at)}
                            edited={!!item.edited_at}
                            mine={mine}
                          />
                        </View>
                      ) : hasFile ? (
                        <View style={styles.fileTimeWrap}>
                          <MessageTime
                            time={formatTime(item.created_at)}
                            edited={!!item.edited_at}
                            mine={mine}
                          />
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
                <Text style={styles.emptyTitle}>Мессеж алга</Text>
                <Text style={styles.emptySub}>Эхний мессежээ бичээрэй</Text>
              </View>
            </View>
          }
        />

        <SafeAreaView edges={['bottom']} style={styles.composerSafe}>
          {editingId ? (
            <View style={styles.editBar}>
              <View style={styles.editBarAccent} />
              <View style={styles.editBarBody}>
                <Text style={styles.editLabel}>Засах</Text>
                <Text style={styles.editPreview} numberOfLines={1}>{text}</Text>
              </View>
              <TouchableOpacity onPress={cancelEdit} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}
          {voiceActive || voicePreview ? (
            <View style={styles.voiceBar}>
              <View style={styles.voiceDot} />
              <Text style={styles.voiceText} numberOfLines={2}>
                {voicePreview || 'Ярьж байна...'}
              </Text>
              <Text style={styles.voiceHint}>Суллана</Text>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.toolBtn, (uploading || voiceActive) && styles.toolBtnDisabled]}
              onPress={chooseAttachment}
              disabled={uploading || voiceActive}
              accessibilityLabel="Хавсаргах"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="attach" size={26} color={colors.textMuted} style={styles.attachIcon} />
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={voiceActive ? 'Ярьж байна...' : 'Мессеж'}
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              editable={!voiceActive}
            />
            {text.trim() || editingId ? (
              <TouchableOpacity
                style={[styles.sendBtn, voiceActive && styles.toolBtnDisabled]}
                onPress={() => send()}
                disabled={voiceActive || !text.trim()}
                accessibilityLabel="Илгээх"
              >
                <Ionicons
                  name={editingId ? 'checkmark' : 'send'}
                  size={editingId ? 22 : 18}
                  color="#fff"
                  style={!editingId ? styles.sendIconOffset : undefined}
                />
              </TouchableOpacity>
            ) : (
              <VoiceMessageButton
                disabled={uploading}
                onPartial={setVoicePreview}
                onFinal={sendVoiceText}
                onListeningChange={setVoiceActive}
                telegram
              />
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <ChatImagePreview uri={previewImage} onClose={() => setPreviewImage(null)} />
      <ChatVideoPreview uri={previewVideo} onClose={() => setPreviewVideo(null)} />

      <CallScreen
        visible={!!outgoing}
        mode="outgoing"
        name={otherUser?.name || 'Ажилтан'}
        video
        status="Залгаж байна..."
        onCancel={cancelOutgoing}
      />

      <VideoCallModal
        visible={callVisible}
        room={`gennetex-${room}`}
        name={me?.name}
        onClose={() => setCallVisible(false)}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1, backgroundColor: colors.background },
  headerSafe: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: colors.primary,
  },
  headerBack: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 },
  headerSubOnline: { color: '#B5E0A8' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBar: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { color: '#B91C1C', fontSize: 13 },
  chatBg: { flex: 1, backgroundColor: colors.background },
  messageList: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10 },
  messageListEmpty: { flexGrow: 1, justifyContent: 'center' },
  dateChipWrap: { alignItems: 'center', marginVertical: 10 },
  dateChip: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bubbleRow: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleRowTight: { marginBottom: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginBottom: 1,
  },
  msgAvatarSpacer: { width: 36 },
  msgAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubbleTouch: { maxWidth: '82%' },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  bubbleMine: {
    backgroundColor: colors.primaryContainer,
    borderBottomRightRadius: 16,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceContainerHigh,
    borderBottomLeftRadius: 16,
  },
  bubbleMineTail: { borderBottomRightRadius: 4 },
  bubbleOtherTail: { borderBottomLeftRadius: 4 },
  bubbleMedia: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  sender: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  senderOnMedia: {
    marginBottom: 4,
    marginLeft: 2,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  msgText: { color: colors.text, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  msgTextMine: { color: colors.onPrimaryContainer },
  msgContentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 8,
    rowGap: 0,
  },
  mediaWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  msgImage: {
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  mediaFallback: {
    width: IMAGE_MAX_W,
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  mediaFallbackText: { color: colors.primary, fontWeight: '600' },
  videoThumb: {
    width: VIDEO_THUMB_W,
    height: VIDEO_THUMB_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A3A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
    maxWidth: 240,
    paddingVertical: 4,
  },
  fileChipMine: {},
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconWrapMine: { backgroundColor: colors.success },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  fileSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  fileTimeWrap: { alignSelf: 'flex-end', marginTop: 2 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    marginTop: 2,
    paddingLeft: 8,
  },
  timeRowOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 0,
    marginTop: 0,
  },
  timeText: { color: colors.textMuted, fontSize: 11 },
  timeTextMine: { color: colors.onPrimaryContainer },
  timeTextOverlay: { color: '#fff' },
  checkIcon: { marginLeft: 2 },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 24 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13 },
  composerSafe: { backgroundColor: colors.surface },
  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  editBarAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  editBarBody: { flex: 1, minWidth: 0 },
  editLabel: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  editPreview: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  voiceText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  voiceHint: { color: colors.textMuted, fontSize: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 4,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 9 : 7,
    paddingBottom: Platform.OS === 'ios' ? 9 : 7,
    color: colors.text,
    maxHeight: 110,
    minHeight: 40,
    fontSize: 16,
    lineHeight: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnDisabled: { opacity: 0.4 },
  attachIcon: { transform: [{ rotate: '45deg' }] },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconOffset: { marginLeft: 2 },
});
