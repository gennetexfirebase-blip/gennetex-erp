import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import NavIcon from './NavIcon';
import { useApp } from '../context/AppContext';
import * as notificationApi from '../services/notificationCenterService';

const ICONS = {
  Home: 'home',
  Attendance: 'attendance',
  Feed: 'feed',
  Chat: 'chat',
  Profile: 'profile',
  Notifications: 'notifications',
};

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

  return (
    // Хөвөгч цэс: дэлгэцийн ирмэгээс зайтай, бүрэн дугуй булантай.
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 6, 10) }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
            borderColor: isDark ? colors.outlineVariant : 'rgba(15,23,42,0.06)',
          },
          Platform.select({
            android: { elevation: 10 },
            default: {
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.4 : 0.12,
              shadowRadius: 24,
            },
          }),
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () =>
            navigation.emit({ type: 'tabLongPress', target: route.key });

          const icon = ICONS[route.name] || 'home';
          const showBadge = route.name === 'Notifications' && unread > 0;

          // Таб бүр ЯГ ижил өргөнтэй (`flex: 1`) бөгөөд идэвхтэй, идэвхгүй
          // хоёулаа ижил бүтэцтэй. Тиймээс таб солиход юу ч байрлалаа
          // өөрчлөхгүй. Өмнө нь идэвхтэй нь өргөн бөмбөлөг болж, бусдыг
          // шахаж, зай жигд бус болдог байв.
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
              <View
                style={[
                  styles.iconWrap,
                  focused && { backgroundColor: colors.primary },
                ]}
              >
                <NavIcon
                  name={icon}
                  size={22}
                  color={focused ? colors.onPrimary : colors.onSurfaceVariant}
                  active={focused}
                  activeColor={colors.onPrimary}
                />
                {showBadge ? (
                  <View style={[styles.countBadge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.countText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: focused ? colors.primary : colors.textFaint },
                  focused && styles.labelFocused,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    alignSelf: 'stretch',
    gap: 2,
    borderRadius: 26,
    borderWidth: 1,
  },
  // Бүх таб ижил өргөнтэй. Идэвхтэй нь зөвхөн дүрсний ард бөмбөлөг нэмнэ —
  // хэмжээ өөрчлөгдөхгүй тул таб солиход юу ч шилжихгүй.
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },
  labelFocused: { fontWeight: '700' },
  countBadge: { position: 'absolute', right: 2, top: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
