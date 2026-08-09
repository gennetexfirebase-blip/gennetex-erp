import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import Voice from '@react-native-voice/voice';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

const LOCALES = ['mn-MN', 'mn-MN-u-ms-siri', 'en-US'];

export default function VoiceDictation({ onResult, disabled }) {
  const [listening, setListening] = useState(false);
  const localeRef = useRef(LOCALES[0]);
  const mounted = useRef(true);
  const styles = useStyles(makeStyles);

  useEffect(() => {
    mounted.current = true;
    Voice.onSpeechResults = (e) => {
      const text = e.value?.[0];
      if (text && mounted.current) {
        onResult?.(text);
        setListening(false);
      }
    };
    Voice.onSpeechError = () => {
      if (mounted.current) setListening(false);
    };
    Voice.onSpeechEnd = () => {
      if (mounted.current) setListening(false);
    };
    return () => {
      mounted.current = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [onResult]);

  if (Platform.OS === 'web') return null;

  const start = async () => {
    if (disabled || listening) return;
    try {
      setListening(true);
      let started = false;
      for (const loc of LOCALES) {
        try {
          await Voice.start(loc);
          localeRef.current = loc;
          started = true;
          break;
        } catch (e) {}
      }
      if (!started) throw new Error('no locale');
    } catch (e) {
      setListening(false);
      Alert.alert(
        'Дуу хоолой',
        Platform.OS === 'web'
          ? 'Вэб дээр дуу хоолой ажиллахгүй.'
          : 'Монгол дуу хоолой таних боломжгүй. Утсандаа Google дуу хоолой идэвхжүүлнэ үү.'
      );
    }
  };

  const stop = async () => {
    try {
      await Voice.stop();
    } catch (e) {}
    setListening(false);
  };

  return (
    <TouchableOpacity
      style={[styles.btn, listening && styles.btnActive, disabled && styles.btnDisabled]}
      onPress={listening ? stop : start}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>{listening ? '■' : 'MIC'}</Text>
      {listening ? <Text style={styles.hint}>Сонсож байна...</Text> : null}
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { backgroundColor: colors.danger + '22', borderColor: colors.danger },
  btnDisabled: { opacity: 0.4 },
  icon: { fontSize: 18 },
  hint: {
    position: 'absolute',
    top: -22,
    fontSize: 10,
    color: colors.danger,
    fontWeight: '700',
    width: 90,
    textAlign: 'center',
  },
});
