import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchArticles, listCategories, BUILTIN_ARTICLES } from '../../services/knowledgeBaseService';

export default function KnowledgeBaseScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const [items, setItems] = useState(BUILTIN_ARTICLES);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const list = await fetchArticles({ query: q, category: cat || undefined });
    setItems(list);
  }, [q, cat]);

  React.useEffect(() => {
    load();
  }, [load]);

  const cats = listCategories(items.length ? items : BUILTIN_ARTICLES);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Мэдлэгийн сан</Text>
        <TextInput
          style={styles.input}
          placeholder="Хайх…"
          placeholderTextColor={colors.textFaint}
          value={q}
          onChangeText={setQ}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats}>
          <TouchableOpacity style={[styles.chip, !cat && styles.chipOn]} onPress={() => setCat(null)}>
            <Text style={[styles.chipText, !cat && styles.chipTextOn]}>Бүгд</Text>
          </TouchableOpacity>
          {cats.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, cat === c && styles.chipOn]} onPress={() => setCat(c)}>
              <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setOpen(item)}>
            <Text style={styles.cat}>{item.category}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.preview} numberOfLines={2}>{item.body}</Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={styles.modal}>
          <TouchableOpacity onPress={() => setOpen(null)}>
            <Text style={styles.back}>← Хаах</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{open?.title}</Text>
          <ScrollView>
            <Text style={styles.body}>{open?.body}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    cats: { marginBottom: spacing.sm, maxHeight: 40 },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
    chipTextOn: { color: colors.primary },
    list: { padding: spacing.lg, paddingBottom: 60 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    cat: { color: colors.primary, fontSize: 11, fontWeight: '800', marginBottom: 4 },
    cardTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
    preview: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
    modal: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginVertical: spacing.md },
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  });
