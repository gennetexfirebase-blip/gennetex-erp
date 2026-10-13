import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import * as notificationApi from '../services/notificationCenterService';
import { RoundButton, Avatar } from './ds';

/**
 * Толгойн баруун тал: мэдэгдэл (дугуй товч + улаан badge) ба
 * профайлын зураг (→ Профайл). `onBrand` нь хуучин дуудлагад зориулж
 * хүлээн авна — шинэ дизайнд өнгөт толгой байхгүй.
 */
export default function HeaderAccountActions({ showProfile = true } = {}) {
  const navigation = useNavigation();
  const { currentUser, authProfile, profile } = useApp();
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!currentUser?.id) return;
    let active = true;
    const load = () => notificationApi.fetchUnreadCount(currentUser.id).then((count) => { if (active) setUnread(count); }).catch(() => {});
    load();
    const unsubscribe = notificationApi.subscribeNotifications(currentUser.id, load);
    return () => { active = false; unsubscribe?.(); };
  }, [currentUser?.id]));
  const name = authProfile?.name || profile?.name || currentUser?.name || '';
  const avatar = authProfile?.avatar_url || profile?.avatar_url || currentUser?.avatar_url || null;
  return (
    <View style={styles.row}>
      <RoundButton
        icon="notifications-outline"
        badge={unread > 0 ? unread : null}
        onPress={() => navigation.navigate('Notifications')}
        accessibilityLabel={`Мэдэгдэл${unread ? `, ${unread} шинэ` : ''}`}
      />
      {showProfile ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Миний профайл" onPress={() => navigation.navigate('Profile')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Avatar uri={avatar} name={name} size={40} />
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
