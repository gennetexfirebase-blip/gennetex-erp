import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  askGennetexAi,
  getGeminiKeyAsync,
  loadGennetexChatHistory,
  saveGennetexChatHistory,
  saveGeminiKeyLocal,
} from '../services/gennetexAiService';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

const GENNETEX_LOGO = require('../../assets/logo.png');

const AI_BRAND = '#0F766E';

const WELCOME =
  'Сайн байна уу! Би Gennetex AI.\n\nСүлжээ, интернет, ONU, router, Wi‑Fi, кабель зэрэг асуудлаа асуугаарай. Би заавар болон холбогдох YouTube видео илгээнэ.';

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function VideoCard({ video }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  if (!video?.url) return null;
  return (
    <TouchableOpacity
      style={styles.videoWrap}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(video.url)}
    >
      {video.thumb ? (
        <Image source={{ uri: video.thumb }} style={styles.videoThumb} />
      ) : (
        <View style={[styles.videoThumb, styles.videoThumbPlaceholder]}>
          <Ionicons name="logo-youtube" size={36} color="#FF0000" />
        </View>
      )}
      <View style={styles.videoCard}>
        <View style={styles.videoMeta}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {video.title || 'YouTube видео'}
          </Text>
          <Text style={styles.videoLink}>
            {video.isSearch ? 'YouTube дээр хайх' : 'Видео нээх'}
          </Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function Bubble({ item }) {
  const styles = useStyles(makeStyles);
  const mine = item.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMe]}>
      {!mine ? (
        <View style={styles.aiAvatar}>
          <Image source={GENNETEX_LOGO} style={styles.aiAvatarLogo} resizeMode="contain" />
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleAi]}>
        {!mine ? <Text style={styles.aiName}>Gennetex AI</Text> : null}
        <Text style={[styles.bubbleText, mine && styles.textMine]}>{item.content}</Text>
        {item.videos?.length
          ? item.videos.map((v) => <VideoCard key={v.id || v.url} video={v} />)
          : null}
      </View>
    </View>
  );
}

export default function GennetexAiScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME,
      videos: [],
      created_at: new Date().toISOString(),
    },
  ]);

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  useEffect(() => {
    (async () => {
      const [key, saved] = await Promise.all([getGeminiKeyAsync(), loadGennetexChatHistory()]);
      setHasKey(Boolean(key));
      if (saved?.length) setMessages(saved);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveGennetexChatHistory(messages);
  }, [messages, ready]);

  useEffect(() => {
    if (atBottomRef.current) scrollToEnd();
  }, [messages.length, scrollToEnd]);

  const saveKey = async () => {
    const k = apiKeyInput.trim().replace(/^['"]|['"]$/g, '');
    if (!k) return;
    setSavingKey(true);
    try {
      await saveGeminiKeyLocal(k);
      setHasKey(true);
      setApiKeyInput('');
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: 'API түлхүүр хадгалагдлаа. Одоо сүлжээний асуултаа асуугаарай.',
          videos: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: e.message || 'Түлхүүр хадгалахад алдаа',
          videos: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSavingKey(false);
    }
  };

  const send = useCallback(async () => {
    const q = text.trim();
    if (!q || sending) return;

    const key = await getGeminiKeyAsync();
    if (!key) {
      setHasKey(false);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', content: q, created_at: new Date().toISOString() },
        {
          id: uid(),
          role: 'assistant',
          content: 'Эхлээд доорх талбарт Gemini API түлхүүрээ оруулна уу.',
          videos: [],
          created_at: new Date().toISOString(),
        },
      ]);
      setText('');
      return;
    }

    const userMsg = {
      id: uid(),
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    };
    atBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg]);
    setText('');
    setSending(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await askGennetexAi(q, history);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: res.answer,
          videos: res.videos || [],
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      const msg = e.message || 'Алдаа гарлаа. Дахин оролдоно уу.';
      if (/API key|invalid|PERMISSION|403|401|түлхүүр/i.test(msg)) {
        setHasKey(false);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: msg,
          videos: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [text, sending, messages]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={colors.onPrimaryContainer} />
          </TouchableOpacity>
          <View style={styles.headerAvatar}>
            <Image source={GENNETEX_LOGO} style={styles.headerLogo} resizeMode="contain" />
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>Gennetex AI</Text>
            <Text style={styles.headerSub}>Сүлжээний туслах · онлайн</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          style={styles.listFlex}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Bubble item={item} />}
          showsVerticalScrollIndicator
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            atBottomRef.current =
              contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (atBottomRef.current) scrollToEnd(false);
          }}
        />

        {sending ? (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={AI_BRAND} />
            <Text style={styles.typingText}>Gennetex AI бичиж байна...</Text>
          </View>
        ) : null}

        <SafeAreaView edges={['bottom']} style={styles.inputSafe}>
          {ready && !hasKey ? (
            <View style={styles.keyBox}>
              <Text style={styles.keyTitle}>Gemini API түлхүүр</Text>
              <Text style={styles.keyHint}>
                https://aistudio.google.com/apikey — Create API key хийгээд доор наана
              </Text>
              <TextInput
                style={styles.keyInput}
                placeholder="AIzaSy..."
                placeholderTextColor={colors.textMuted}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.keySaveBtn, (!apiKeyInput.trim() || savingKey) && styles.sendBtnDisabled]}
                onPress={saveKey}
                disabled={!apiKeyInput.trim() || savingKey}
              >
                {savingKey ? (
                  <ActivityIndicator color={colors.onPrimaryContainer} />
                ) : (
                  <Text style={styles.keySaveText}>Хадгалаад эхлүүлэх</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Сүлжээний асуултаа бичнэ үү..."
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!text.trim() || sending}
              >
                <Ionicons name="send" size={18} color={colors.onPrimaryContainer} />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerSafe: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerLogo: { width: 32, height: 32 },
  headerMeta: { flex: 1 },
  headerTitle: { color: colors.onPrimaryContainer, fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.onPrimaryContainer, fontSize: 12, marginTop: 1 },
  listFlex: { flex: 1 },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', maxWidth: '92%' },
  bubbleRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  aiAvatarLogo: { width: 22, height: 22 },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleMe: { backgroundColor: colors.primaryContainer, borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, flex: 1 },
  aiName: { color: AI_BRAND, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  textMine: { color: colors.onPrimaryContainer },
  videoWrap: { marginTop: 10, gap: 6 },
  videoThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  videoThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    padding: 8,
  },
  videoMeta: { flex: 1 },
  videoTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  videoLink: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600' },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingText: { color: colors.textMuted, fontSize: 13 },
  inputSafe: { backgroundColor: colors.surface },
  keyBox: {
    padding: 14,
    backgroundColor: colors.successSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.success,
    gap: 8,
  },
  keyTitle: { fontWeight: '800', color: colors.success, fontSize: 15 },
  keyHint: { color: colors.success, fontSize: 12, lineHeight: 17 },
  keyInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  keySaveBtn: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  keySaveText: { color: colors.onPrimaryContainer, fontWeight: '800' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
