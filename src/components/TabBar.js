import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import * as notificationApi from '../services/notificationCenterService';
import { alpha } from './ds';

// Дизайн (prototype): 4 таб — Нүүр, Ирц, Пост, Чат. Lucide шугаман icon,
// stroke 1.9; идэвхтэй нь зөвхөн өнгөөрөө (brand) ялгарна.
const LUCIDE = {
  Home: [
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
    'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  ],
  Attendance: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18', 'm9 16 2 2 4-4'],
  Feed: [
    'M15 18h-5',
    'M18 14h-8',
    'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2',
    'M11 6h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  ],
  Chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  Profile: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 1 0 8a4 4 0 0 1 0-8z'],
  Notifications: [
    'M10.268 21a2 2 0 0 0 3.464 0',
    'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  ],
};

function TabIcon({ name, color, size = 25 }) {
  const paths = LUCIDE[name] || LUCIDE.Home;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

/**
 * Доод таб: цагаан, 88% тунгалаг + blur, дээд талдаа 1px шугам,
 * идэвхтэй нь `brand`. Улаан badge.
 */
export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useApp();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () => notificationApi.fetchUnreadCount(currentUser?.id).then(setUnread).catch(() => {});
    load();
    return notificationApi.subscribeNotifications(currentUser?.id, load);
  }, [currentUser?.id]);

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const label = options.title ?? route.name;
    const focused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

    const showBadge = route.name === 'Notifications' && unread > 0;
    const tint = focused ? colors.brand : colors.faint;

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={showBadge ? `${label}, ${unread} шинэ` : label}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        style={styles.item}
      >
        <View>
          <TabIcon name={route.name} color={tint} />
          {showBadge ? (
            <View style={[styles.badge, { backgroundColor: colors.bad, borderColor: colors.bg }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  });

  const pad = { paddingBottom: Math.max(insets.bottom, 10) };

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.line }]}>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.bg, 0.88) }]} />
        <View style={[styles.row, pad]}>{items}</View>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>
      <View style={[styles.row, pad]}>{items}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8 },
  item: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    left: 16,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
