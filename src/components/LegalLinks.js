import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from './ui';
import { LEGAL_LINKS, openLegalLink } from '../lib/legalLinks';
import { useTheme } from '../context/ThemeContext';

export default function LegalLinks({ compact = false }) {
  const { colors } = useTheme();
  if (compact) return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, marginTop: 14 }}>
      {LEGAL_LINKS.map(link => (
        <Pressable key={link.key} accessibilityRole="link" onPress={() => openLegalLink(link)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' }}>{link.title}</Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {LEGAL_LINKS.map((link) => (
        <Button key={link.key} title={link.title} variant="ghost" onPress={() => openLegalLink(link)} />
      ))}
    </View>
  );
}
