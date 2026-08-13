import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius } from '../theme';
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
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
          Platform.select({
            android: { elevation: 6 },
            ios: {
              shadowColor: colors.glowShadow,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: isDark ? 0.15 : 0.06,
              shadowRadius: 16,
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
                  focused && { backgroundColor: colors.primarySoft },
                ]}
              >
                <NavIcon
                  name={icon}
                  size={22}
                  color={focused ? colors.primary : colors.onSurfaceVariant}
                  active={focused}
                  activeColor={colors.primary}
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
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: spacing.lg,
    gap: 4,
    borderWidth: 1,
  },
  // Бүх таб ижил өргөнтэй. Идэвхтэй нь зөвхөн дүрсний ард бөмбөлөг нэмнэ —
  // хэмжээ өөрчлөгдөхгүй тул таб солиход юу ч шилжихгүй.
  item: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: -0.1 },
  labelFocused: { fontWeight: '800' },
  countBadge: { position: 'absolute', right: 2, top: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
