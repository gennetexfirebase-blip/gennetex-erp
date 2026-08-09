/**
 * Scan-only горим — ирэх/гарах барааг зөвхөн barcode-оор.
 * Хуучин Inventory/BarcodeScanner-тай зэрэгцэнэ.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import BarcodeScanner from '../../components/BarcodeScanner';

export default function BarcodeModeScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [scanOpen, setScanOpen] = useState(false);
  const [mode, setMode] = useState('in'); // in | out
  const [log, setLog] = useState([]);
  const [manual, setManual] = useState('');

  const push = (code) => {
    if (!code) return;
    setLog((prev) => [
      { id: `${Date.now()}`, code: String(code), mode, at: new Date().toISOString() },
      ...prev,
    ].slice(0, 100));
    Alert.alert(mode === 'in' ? 'Орлого' : 'Зарлага', `Barcode: ${code}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Barcode горим</Text>
        <Text style={styles.sub}>Зөвхөн scan — алдаа багасна</Text>
      </View>

      <View style={styles.dirRow}>
        {['in', 'out'].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dirBtn, mode === d && styles.dirOn]}
            onPress={() => setMode(d)}
          >
            <Text style={[styles.dirText, mode === d && styles.dirTextOn]}>
              {d === 'in' ? 'Орлого' : 'Зарлага'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.scan} onPress={() => setScanOpen(true)}>
        <Text style={styles.scanText}>📷 Сканнер нээх</Text>
      </TouchableOpacity>

      <View style={styles.manual}>
        <TextInput
          style={styles.input}
          value={manual}
          onChangeText={setManual}
          placeholder="Гараар barcode"
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={() => {
            push(manual.trim());
            setManual('');
          }}
        />
      </View>

      <FlatList
        data={log}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.listTitle}>Сүүлийн скан</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.meta}>{item.mode} · {item.at.slice(11, 19)}</Text>
          </View>
        )}
      />

      <BarcodeScanner
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(code) => {
          setScanOpen(false);
          push(code);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    sub: { color: colors.textMuted },
    dirRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    dirBtn: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    dirOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    dirText: { color: colors.textMuted, fontWeight: '700' },
    dirTextOn: { color: colors.primary },
    scan: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    scanText: { color: colors.onPrimary || '#003', fontWeight: '800', fontSize: 16 },
    manual: { padding: spacing.lg },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      color: colors.text,
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    listTitle: { color: colors.textMuted, fontWeight: '700', marginBottom: spacing.sm },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    code: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12 },
  });
