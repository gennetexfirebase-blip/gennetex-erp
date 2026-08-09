import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, EmptyState } from '../components/ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';
import * as chatApi from '../services/chatService';

export default function ChatArchiveScreen() {
  const styles = useStyles(makeStyles);
  const { currentUser, isCloud } = useApp();
  const [files, setFiles] = useState([]);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setFiles(await chatApi.fetchMyChatFiles(currentUser.id));
    } catch (e) {}
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openFile = (url) => {
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Файлын архив" subtitle="Чатаар илгээсэн файлууд"/>
      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openFile(item.attachment_url)}>
            <Text style={styles.icon}>
              {item.attachment_type === 'image' ? '' : item.attachment_type === 'video' ? '' : ''}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.attachment_name || item.content || 'Файл'}
              </Text>
              <Text style={styles.sub}>
                {item.sender_name} · {new Date(item.created_at).toLocaleString('mn-MN')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState text="Илгээсэн файл алга." />}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 24 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
