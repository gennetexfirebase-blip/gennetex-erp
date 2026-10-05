import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, ListGroup, ListRow, GroupLabel } from '../components/ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

/**
 * "Багаж, хангамж" — хоёр жагсаалтын төв цэс.
 *
 * ЯАГААД ЭНЭ ХОЁР НЬ ХАМТ ВЭ:
 *   Багаж ба хангамж хоёул ажилтанд ОЛГОГДДОГ зүйл — олголт, буцаалт,
 *   ажилтны үлдэгдэл гэсэн ижил урсгалтай. Бараа материал нь агуулахын
 *   үлдэгдэл тул нүүр дээр ТУСДАА хавтангаар үлдэнэ.
 *
 * ХАНГАМЖ ЯАГААД ТУСДАА ЖАГСААЛТ ВЭ:
 *   Хангамж нь размертай (хувцас S-4XL, гутал 39-46). Багаж размергүй.
 *   Тиймээс бүртгэх урсгал нь өөр.
 */

const SECTIONS = [
  {
    key: 'Tools',
    icon: '🔧',
    label: 'Багаж',
    desc: 'Багажны бүртгэл, олголт, эвдрэл',
    category: 'tool',
  },
  {
    key: 'Supplies',
    icon: '🧤',
    label: 'Хангамж',
    desc: 'Хувцас, гутал болон бусад хангамж',
    category: 'supply',
  },
];

export default function ToolsHubScreen() {
  const navigation = useNavigation();
  const styles = useStyles(makeStyles);
  const { inventory } = useApp();

  /** Төрөл тус бүрийн нэр төрлийн тоо — жагсаалт руу орохоос өмнө харагдана. */
  const counts = useMemo(() => {
    const out = { tool: 0, supply: 0 };
    for (const it of inventory || []) {
      const cat = it.category || 'material';
      if (out[cat] !== undefined) out[cat] += 1;
    }
    return out;
  }, [inventory]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Багаж, хангамж" subtitle="Төрлөө сонгоно уу" icon="🧰" />
      <ScrollView contentContainerStyle={styles.body}>
        <GroupLabel>Жагсаалтууд</GroupLabel>
        <ListGroup>
          {SECTIONS.map((s) => (
            <ListRow
              key={s.key}
              icon={s.icon}
              label={s.label}
              value={`${counts[s.category]} нэр төрөл`}
              onPress={() => navigation.navigate(s.key)}
            />
          ))}
        </ListGroup>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Хангамжийн хувцас, гутлыг размер бүрээр нь бүртгэнэ. Ажилтанд олгоход
            тухайн размерын үлдэгдлээс хасагдана.
          </Text>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hint: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
  hintText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
