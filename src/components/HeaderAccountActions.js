import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import * as notificationApi from '../services/notificationCenterService';

/** `onBrand` — брэндийн gradient hero дээр (цагаан хагас тунгалаг товч). */
export default function HeaderAccountActions({ onBrand = false } = {}) {
  const navigation = useNavigation();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [unread, setUnread] = useState(0);
  const tone = onBrand
    ? { bg: 'rgba(255,255,255,0.16)', border: 'rgba(255,255,255,0.22)', icon: '#fff', profileBg: 'rgba(255,255,255,0.16)', profileIcon: '#fff' }
    : { bg: colors.surfaceAlt, border: colors.border, icon: colors.text, profileBg: colors.primarySoft, profileIcon: colors.primary };
  useFocusEffect(useCallback(() => {
    if (!currentUser?.id) return;
    let active = true;
    const load = () => notificationApi.fetchUnreadCount(currentUser.id).then((count) => { if (active) setUnread(count); }).catch(() => {});
    load();
    const unsubscribe = notificationApi.subscribeNotifications(currentUser.id, load);
    return () => { active = false; unsubscribe?.(); };
  }, [currentUser?.id]));
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Мэдэгдэл${unread ? `, ${unread} шинэ` : ''}`} onPress={() => navigation.navigate('Notifications')} style={({ pressed }) => [styles.button, { backgroundColor: tone.bg, borderColor: tone.border, opacity: pressed ? .65 : 1 }]}>
      <Ionicons name="notifications-outline" size={22} color={tone.icon} />
      {unread > 0 && <View style={[styles.badge, { backgroundColor: colors.danger }]}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Миний профайл" onPress={() => navigation.navigate('Profile')} style={({ pressed }) => [styles.button, { backgroundColor: tone.profileBg, borderColor: tone.border, opacity: pressed ? .65 : 1 }]}>
      <Ionicons name="person-outline" size={22} color={tone.profileIcon} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 }, button: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, badge: { position: 'absolute', right: -3, top: -4, minWidth: 17, paddingHorizontal: 4, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' } });
