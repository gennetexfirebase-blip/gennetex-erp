import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as tg from '../services/telegramUserService';
import { formatTime, formatChatDay, isSameChatDay } from '../lib/formatTime';
import { avatarGradient, initials } from '../lib/telegram/avatarColor';

const TG_BLUE = '#229ED9';
const TG_BLUE_DARK = '#1C8CC2';

function Bubble({ item, showDay }) {
  const styles = useStyles(makeStyles);
  const mine = item.out;
  return (
    <>
      {showDay ? (
        <View style={styles.dayWrap}>
          <Text style={styles.dayText}>{formatChatDay(item.date)}</Text>
        </View>
      ) : null}
      <View style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapOther]}>
        {mine ? (
          <LinearGradient
            colors={[TG_BLUE, TG_BLUE_DARK]}
            style={[styles.bubble, styles.bubbleMine]}
          >
            <Text style={[styles.text, styles.textMine]}>{item.text}</Text>
            {item.date ? (
              <Text style={[styles.time, styles.timeMine]}>{formatTime(item.date)}</Text>
            ) : null}
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleOther]}>
            <Text style={styles.text}>{item.text}</Text>
            {item.date ? <Text style={styles.time}>{formatTime(item.date)}</Text> : null}
          </View>
        )}
      </View>
    </>
  );
}

export default function TelegramDialogScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { id, title } = route.params || {};
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  const grad = useMemo(() => avatarGradient(title || 'Чат'), [title]);

  const load = useCallback(async () => {
    try {
      const data = await tg.fetchMessages(id, 50);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e.message || 'Мессеж ачаалахад алдаа');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    let unsub;
    tg.subscribeNewMessages((chatId) => {
      if (String(chatId) === String(id)) load();
    })
      .then((fn) => {
        unsub = fn;
      })
      .catch(() => {});
    return () => {
      if (unsub) unsub();
    };
  }, [id, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await tg.sendMessage(id, body);
      setRows((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e) {
      setText(body);
      setError(e.message || 'Илгээх амжилтгүй');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[TG_BLUE, TG_BLUE_DARK]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <LinearGradient colors={grad} style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initials(title || 'Ч')}</Text>
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title || 'Чат'}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>Telegram</Text>
        </View>
      </LinearGradient>

      {error ? (
        <TouchableOpacity style={styles.errBar} onPress={() => setError(null)}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errText}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={TG_BLUE} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length ? styles.list : styles.listEmpty}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item, index }) => {
              const prev = rows[index - 1];
              const showDay = !prev || !isSameChatDay(prev.date, item.date);
              return <Bubble item={item} showDay={showDay} />;
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={46} color={colors.textFaint} />
                <Text style={styles.empty}>Мессеж алга. Эхний мессежээ бичээрэй.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Мессеж бичих..."
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4000}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <LinearGradient
              colors={!text.trim() || sending ? [colors.outline, colors.outline] : [TG_BLUE, TG_BLUE_DARK]}
              style={styles.sendBtn}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={19} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 10,
      gap: 6,
    },
    backBtn: { padding: 2 },
    headerAvatar: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    headerText: { flex: 1, marginLeft: 4 },
    title: { color: '#fff', fontSize: 17, fontWeight: '700' },
    subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },

    errBar: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.danger + '22', padding: 10,
      marginHorizontal: 12, marginTop: 8, borderRadius: 10,
    },
    errText: { color: colors.danger, fontSize: 13, flex: 1 },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 12, paddingBottom: 8 },
    listEmpty: { flexGrow: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 12, fontSize: 14 },

    dayWrap: { alignItems: 'center', marginVertical: 12 },
    dayText: {
      color: colors.textMuted, fontSize: 12, fontWeight: '600',
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
      overflow: 'hidden',
    },

    bubbleWrap: { marginBottom: 6, maxWidth: '82%' },
    wrapMine: { alignSelf: 'flex-end' },
    wrapOther: { alignSelf: 'flex-start' },
    bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
    bubbleMine: { borderBottomRightRadius: 5 },
    bubbleOther: {
      backgroundColor: colors.surfaceContainerHigh,
      borderBottomLeftRadius: 5,
    },
    text: { color: colors.text, fontSize: 15, lineHeight: 21 },
    textMine: { color: '#fff' },
    time: { color: colors.textFaint, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
    timeMine: { color: 'rgba(255,255,255,0.75)' },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    inputBox: {
      flex: 1,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    input: {
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
