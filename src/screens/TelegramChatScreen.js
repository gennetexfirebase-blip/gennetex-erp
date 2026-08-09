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
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as tgChat from '../services/telegramChatService';
import { formatTime } from '../lib/formatTime';

function MessageBubble({ item, mine }) {
  const styles = useStyles(makeStyles);
  const fromTelegram = item.source === 'telegram';
  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
      {!mine ? (
        <Text style={styles.senderName}>
          {item.sender_name}
          {fromTelegram ? ' · Telegram' : ''}
        </Text>
      ) : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
        <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(item.created_at)}</Text>
      </View>
    </View>
  );
}

export default function TelegramChatScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isCloud } = useApp();
  const me = currentUser;
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);
  const [linkInfo, setLinkInfo] = useState(null);
  const listRef = useRef(null);

  const loadLink = useCallback(async () => {
    if (!isCloud) return;
    try {
      const status = await tgChat.getTelegramLinkStatus();
      setLinkInfo(status);
    } catch {
      // холболтын статус алдаатай байсан ч чат ажиллана
    }
  }, [isCloud]);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const data = await tgChat.fetchTelegramChatMessages(200);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isCloud]);

  useEffect(() => {
    load();
    if (!isCloud) return undefined;
    const unsub = tgChat.subscribeTelegramChat((row) => {
      setRows((prev) => {
        if (prev.some((r) => r.id === row.id)) return prev;
        return [...prev, row];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return unsub;
  }, [isCloud, load]);

  useFocusEffect(
    useCallback(() => {
      loadLink();
    }, [loadLink])
  );

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !me?.id) return;
    setSending(true);
    setText('');
    try {
      await tgChat.sendTelegramChatMessage({
        content: body,
        senderId: me.id,
        senderName: me.name,
      });
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setText(body);
      setError(e.message || 'Илгээх амжилтгүй');
    } finally {
      setSending(false);
    }
  };

  const linkTelegram = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const data = await tgChat.createTelegramLink();
      const url = data?.deep_link;
      if (!url) throw new Error('Холбоос олдсонгүй');
      Alert.alert(
        'Telegram холбох',
        'Telegram нээгдэхэд «Start» дарна уу. 15 минутын дотор холбогдоно.',
        [
          { text: 'Болих', style: 'cancel' },
          {
            text: 'Telegram нээх',
            onPress: () => Linking.openURL(url).catch(() => setError('Telegram нээж чадсангүй')),
          },
        ],
      );
    } catch (e) {
      setError(e.message || 'Холбох амжилтгүй');
    } finally {
      setLinking(false);
    }
  };

  const unlinkTelegram = () => {
    Alert.alert('Telegram салгах', 'Таны Telegram холболтыг салгах уу?', [
      { text: 'Үгүй', style: 'cancel' },
      {
        text: 'Салгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await tgChat.unlinkTelegram();
            await loadLink();
          } catch (e) {
            setError(e.message || 'Салгах амжилтгүй');
          }
        },
      },
    ]);
  };

  const linked = !!linkInfo?.linked;
  const tgLabel = linkInfo?.telegram_username
    ? `@${linkInfo.telegram_username}`
    : linked
      ? 'Холбогдсон'
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Telegram чат</Text>
          <Text style={styles.sub}>
            {linked
              ? `Telegram холбогдсон${tgLabel && tgLabel !== 'Холбогдсон' ? ` · ${tgLabel}` : ''}`
              : 'Ажилтан + админ · Telegram-тай холбоно'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={linked ? unlinkTelegram : linkTelegram}
          style={[styles.tgBtn, linked && styles.tgBtnLinked]}
          disabled={linking}
          accessibilityLabel={linked ? 'Telegram салгах' : 'Telegram холбох'}
        >
          {linking ? (
            <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
          ) : (
            <Ionicons
              name={linked ? 'checkmark-circle' : 'link'}
              size={22}
              color={colors.onPrimaryContainer}
            />
          )}
        </TouchableOpacity>
      </View>

      {!linked ? (
        <TouchableOpacity style={styles.linkBanner} onPress={linkTelegram} disabled={linking}>
          <Ionicons name="paper-plane" size={18} color="#fff" />
          <Text style={styles.linkBannerText}>
            Telegram холбох — ботоор чат бичих
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {error ? (
        <TouchableOpacity style={styles.errBar} onPress={() => setError(null)}>
          <Text style={styles.errText}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                mine={item.sender_id === me?.id || item.sender_name === me?.name}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Мессеж алга. Эхний мессежээ илгээнэ үү.</Text>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Telegram групп руу мессеж..."
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnOff]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
            ) : (
              <Ionicons name="send" size={20} color={colors.onPrimaryContainer} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerText: { flex: 1, paddingRight: 12 },
    title: { color: colors.text, fontSize: 18, fontWeight: '800' },
    sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    tgBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tgBtnLinked: { backgroundColor: '#229ED9' },
    linkBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#229ED9',
    },
    linkBannerText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
    errBar: { backgroundColor: colors.danger + '22', padding: 10, marginHorizontal: 12, marginTop: 8, borderRadius: 8 },
    errText: { color: colors.danger, fontSize: 13 },
    list: { padding: 12, paddingBottom: 8 },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 48, fontSize: 14 },
    bubbleWrap: { marginBottom: 10, maxWidth: '88%' },
    bubbleWrapMine: { alignSelf: 'flex-end' },
    bubbleWrapOther: { alignSelf: 'flex-start' },
    senderName: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 4, marginLeft: 4 },
    bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine: { backgroundColor: colors.primaryContainer, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: colors.surfaceContainerLow, borderBottomLeftRadius: 4 },
    bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: colors.onPrimaryContainer },
    time: { color: colors.textFaint, fontSize: 10, marginTop: 6, alignSelf: 'flex-end' },
    timeMine: { color: colors.onPrimaryContainer + '99' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 10,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surfaceContainerLow,
      color: colors.text,
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnOff: { opacity: 0.45 },
  });
