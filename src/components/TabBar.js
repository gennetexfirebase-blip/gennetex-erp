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
            backgroundColor: isDark ? 'rgba(18,33,49,0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: colors.outlineVariant + '55',
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

          if (focused) {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.85}
                style={[styles.itemActive, { backgroundColor: colors.primaryContainer + '1a' }]}
              >
                <NavIcon name={icon} size={20} color={colors.primaryContainer} active activeColor={colors.primaryContainer} />
                <Text style={[styles.labelActive, { color: colors.primaryContainer }]} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: false }}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={styles.item}
            >
              <View>
                <NavIcon name={icon} size={22} color={colors.onSurfaceVariant} />
                {route.name === 'Notifications' && unread > 0 ? <View style={[styles.countBadge, { backgroundColor: colors.danger || '#ef4444' }]}><Text style={styles.countText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
              </View>
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
  item: {
    width: 52,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: radius.lg,
  },
  labelActive: { fontWeight: '800', fontSize: 14 },
  countBadge: { position: 'absolute', right: -10, top: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
