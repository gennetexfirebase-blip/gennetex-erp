import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import {
  fetchBranches,
  getActiveBranchId,
  setActiveBranchId,
  createBranch,
} from '../../services/branchService';

export default function BranchAdminScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [branches, setBranches] = useState([]);
  const [active, setActive] = useState('main');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    setBranches(await fetchBranches());
    setActive(await getActiveBranchId());
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const select = async (id) => {
    await setActiveBranchId(id);
    setActive(id);
  };

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createBranch({ name: name.trim(), code: code.trim() || null });
      setName('');
      setCode('');
      load();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Нэмж чадсангүй (migration?)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Салбар / агуулах</Text>
      </View>
      <FlatList
        data={branches}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Салбарын нэр" placeholderTextColor={colors.textFaint} value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Код" placeholderTextColor={colors.textFaint} value={code} onChangeText={setCode} />
            <TouchableOpacity style={styles.btn} onPress={add}>
              <Text style={styles.btnText}>Нэмэх</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, active === item.id && styles.rowOn]}
            onPress={() => select(item.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.code || ''} · {item.warehouse_name || item.city || ''}</Text>
            </View>
            {active === item.id ? <Text style={styles.active}>Идэвхтэй</Text> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    list: { padding: spacing.lg },
    form: { marginBottom: spacing.lg, gap: spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      color: colors.text,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.md,
      alignItems: 'center',
    },
    btnText: { color: colors.onPrimary || '#003', fontWeight: '800' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    rowOn: { borderColor: colors.primary },
    name: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12 },
    active: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  });
