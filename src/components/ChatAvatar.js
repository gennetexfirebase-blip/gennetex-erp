import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { sanitizeAvatarUrl } from '../lib/avatarUrl';
import PERSON_AVATARS from '../theme/personAvatars';

const AVATAR_COLORS = [
  '#E17076', '#7BC862', '#E5CA77', '#65AADD',
  '#A695E7', '#EE7AAE', '#6EC9CB', '#FAA774',
];

export function chatInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const ch = parts[0]?.[0];
  return ch ? ch.toUpperCase() : '?';
}

export function chatAvatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ChatAvatar({
  name = '',
  uri,
  size = 54,
  style,
  textStyle,
  group = false,
  borderRadius,
}) {
  const safeUri = sanitizeAvatarUrl(uri);
  const [failed, setFailed] = useState(false);
  const radius = borderRadius ?? size / 2;
  const bg = chatAvatarColor(name);

  useEffect(() => {
    setFailed(false);
  }, [safeUri]);

  if (group && !safeUri) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: bg }, style]}>
        <Ionicons name="people" size={Math.round(size * 0.48)} color="#fff" />
      </View>
    );
  }

  if (safeUri && !failed) {
    return (
      <Image
        source={{ uri: safeUri }}
        style={[{ width: size, height: size, borderRadius: radius, backgroundColor: '#eef0f4' }, style]}
        onError={() => setFailed(true)}
        pointerEvents="none"
      />
    );
  }

  // Зураггүй хүн — prototype шиг зурсан хүний дүрс (нэрээр тогтмол).
  if (PERSON_AVATARS.length) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8ED' }, style]}>
        <SvgXml xml={PERSON_AVATARS[h % PERSON_AVATARS.length]} width={size} height={size} />
      </View>
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: bg }, style]}>
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.36) }, textStyle]}>{chatInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { color: '#fff', fontWeight: '700' },
});
