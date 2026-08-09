import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { initials } from '../lib/telegram/avatarColor';

const { width } = Dimensions.get('window');

// Viber маягийн дуудлагын дэлгэц. mode: 'incoming' | 'outgoing'
export default function CallScreen({
  visible,
  mode = 'incoming',
  name = 'Ажилтан',
  status,
  video = true,
  onAccept,
  onDecline,
  onCancel,
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(40);
    Animated.timing(slide, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse, slide]);

  const ring1 = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
  };
  const ring2 = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };

  const statusText =
    status || (mode === 'incoming' ? (video ? 'Видео дуудлага...' : 'Ирж буй дуудлага...') : 'Залгаж байна...');

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onCancel || onDecline}>
      <LinearGradient colors={['#8E7BFF', '#5B3FE9', '#3B1FB5']} style={styles.bg}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <Text style={styles.appTag}>{video ? 'Видео дуудлага' : 'Дуудлага'}</Text>
          </View>

          <View style={styles.center}>
            <View style={styles.avatarZone}>
              <Animated.View style={[styles.ring, ring1]} />
              <Animated.View style={[styles.ring, ring2]} />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(name)}</Text>
              </View>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.status}>{statusText}</Text>
          </View>

          <Animated.View style={[styles.actions, { transform: [{ translateY: slide }] }]}>
            {mode === 'incoming' ? (
              <>
                <View style={styles.actionCol}>
                  <TouchableOpacity style={[styles.roundBtn, styles.decline]} onPress={onDecline} activeOpacity={0.85}>
                    <Ionicons name="call" size={30} color="#fff" style={styles.declineIcon} />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Татгалзах</Text>
                </View>
                <View style={styles.actionCol}>
                  <TouchableOpacity style={[styles.roundBtn, styles.accept]} onPress={onAccept} activeOpacity={0.85}>
                    <Ionicons name={video ? 'videocam' : 'call'} size={30} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Хариулах</Text>
                </View>
              </>
            ) : (
              <View style={styles.actionCol}>
                <TouchableOpacity style={[styles.roundBtn, styles.decline]} onPress={onCancel} activeOpacity={0.85}>
                  <Ionicons name="call" size={30} color="#fff" style={styles.declineIcon} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Дуусгах</Text>
              </View>
            )}
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const AV = 128;
const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: 24 },
  appTag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  center: { alignItems: 'center', marginTop: -40 },
  avatarZone: { width: AV * 1.8, height: AV * 1.8, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: AV,
    height: AV,
    borderRadius: AV / 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  avatar: {
    width: AV,
    height: AV,
    borderRadius: AV / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontSize: 46, fontWeight: '800' },
  name: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 24, textAlign: 'center', paddingHorizontal: 24 },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 10 },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  actionCol: { alignItems: 'center', gap: 12 },
  roundBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  accept: { backgroundColor: '#22C55E' },
  decline: { backgroundColor: '#EF4444' },
  declineIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
