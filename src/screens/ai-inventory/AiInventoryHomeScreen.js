import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { ScreenHeader, Card } from '../../components/ui';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

const ITEMS = [
  {
    key: 'InventoryCamera',
    title: 'AI тооллого',
    desc: 'Камераар бараа тоолох',
    icon: 'camera',
    color: '#0866FF',
    all: true,
  },
  {
    key: 'InventoryHistory',
    title: 'Түүх',
    desc: 'Өмнөх тооллогын бүртгэл',
    icon: 'time',
    color: '#0f766e',
    all: true,
  },
  {
    key: 'ProductTraining',
    title: 'Бүтээгдэхүүн сургалт',
    desc: 'Бүтээгдэхүүн + training зураг',
    icon: 'cube',
    color: '#7c3aed',
    adminOnly: true,
  },
  {
    key: 'InventorySettings',
    title: 'Тохиргоо',
    desc: 'Confidence, FPS, YOLO model',
    icon: 'settings',
    color: '#64748b',
    all: true,
  },
];

export default function AiInventoryHomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { isAdmin } = useApp();

  const items = ITEMS.filter((i) => i.all || (i.adminOnly && isAdmin));

  return (
    <View style={styles.container}>
      <ScreenHeader title="AI Inventory" subtitle="Бараа материал болон багаж — AI тооллого, сургалт" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Камераар барааг тоолж, хүлээгдэж буй үлдэгдэлтэй харьцуулна. Давхардсан илрүүлэлтийг track ID-аар хаана.
        </Text>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(item.key)}
          >
            <Card style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={26} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 0,
    ...shadow.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  desc: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
