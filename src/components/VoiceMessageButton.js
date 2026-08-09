import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pressable, StyleSheet, Platform, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';

const LOCALES = ['mn-MN', 'en-US'];

async function loadSpeechModule() {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('expo-speech-recognition');
    const M = mod?.ExpoSpeechRecognitionModule;
    if (!M) return null;
    try {
      if (typeof M.isRecognitionAvailable === 'function' && !M.isRecognitionAvailable()) return null;
    } catch (e) {
      return null;
    }
    return mod;
  } catch (e) {
    return null;
  }
}

/**
 * Hold-to-talk → текст → шууд илгээх
 * Development build шаардлагатай (Expo Go дээр товч харагдана, дархад заавар гарна).
 */
export default function VoiceMessageButton({
  disabled,
  onFinal,
  onPartial,
  onListeningChange,
  telegram = false,
}) {
  const [listening, setListening] = useState(false);
  const mounted = useRef(true);
  const finalText = useRef('');
  const sentRef = useRef(false);
  const modRef = useRef(null);
  const subsRef = useRef([]);
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const setListeningState = useCallback(
    (v) => {
      setListening(v);
      onListeningChange?.(v);
    },
    [onListeningChange]
  );

  const clearSubs = useCallback(() => {
    subsRef.current.forEach((s) => s.remove());
    subsRef.current = [];
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearSubs();
      try {
        modRef.current?.ExpoSpeechRecognitionModule?.abort?.();
      } catch (e) {}
    };
  }, [clearSubs]);

  const flushSend = useCallback(async () => {
    if (sentRef.current) return;
    const text = finalText.current.trim();
    finalText.current = '';
    onPartial?.('');
    if (text) {
      sentRef.current = true;
      await onFinal?.(text);
      sentRef.current = false;
    }
  }, [onFinal, onPartial]);

  const bindListeners = useCallback(
    (mod) => {
      clearSubs();
      const M = mod.ExpoSpeechRecognitionModule;
      subsRef.current = [
        M.addListener('start', () => {
          if (mounted.current) setListeningState(true);
        }),
        M.addListener('result', (event) => {
          const text = (event.results?.[0]?.transcript || '').trim();
          if (!text || !mounted.current) return;
          finalText.current = text;
          onPartial?.(text);
        }),
        M.addListener('end', () => {
          if (!mounted.current) return;
          setListeningState(false);
          setTimeout(() => flushSend(), 200);
        }),
        M.addListener('error', () => {
          if (mounted.current) setListeningState(false);
        }),
      ];
    },
    [clearSubs, flushSend, onPartial, setListeningState]
  );

  const showDevBuildHelp = () => {
    Alert.alert(
      'Development build шаардлагатай',
      'Дуу хоолойгоор бичих нь Expo Go дээр ажиллахгүй.\n\nAndroid: eas build --profile development --platform android\nДараа нь: npx expo start --dev-client'
    );
  };

  const start = async () => {
    if (disabled || listening) return;
    let mod = modRef.current;
    if (!mod) {
      mod = await loadSpeechModule();
      modRef.current = mod;
    }
    if (!mod) {
      showDevBuildHelp();
      return;
    }

    finalText.current = '';
    sentRef.current = false;
    onPartial?.('');
    bindListeners(mod);

    const M = mod.ExpoSpeechRecognitionModule;
    const perm = await M.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Микрофон болон яриа таних зөвшөөрөл өгнө үү.');
      return;
    }

    try {
      let started = false;
      for (const lang of LOCALES) {
        try {
          M.start({
            lang,
            interimResults: true,
            continuous: true,
            requiresOnDeviceRecognition: false,
          });
          started = true;
          break;
        } catch (e) {}
      }
      if (!started) throw new Error('start failed');
      setListeningState(true);
    } catch (e) {
      setListeningState(false);
      showDevBuildHelp();
    }
  };

  const stop = async () => {
    if (!listening) return;
    const M = modRef.current?.ExpoSpeechRecognitionModule;
    try {
      await M?.stop?.();
    } catch (e) {}
    setListeningState(false);
    setTimeout(() => flushSend(), 300);
  };

  if (Platform.OS === 'web') return null;

  const idleColor = telegram ? '#4FAE4E' : colors.primary;
  const idleBg = telegram ? 'transparent' : colors.primarySoft;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: idleBg },
        listening && styles.btnActive,
        pressed && !listening && (telegram ? styles.btnPressedTg : styles.btnPressed),
        disabled && styles.btnDisabled,
      ]}
      onPressIn={start}
      onPressOut={stop}
      disabled={disabled}
      accessibilityLabel="Дуу хоолой"
      accessibilityHint="Удаан дарж ярина"
    >
      <Ionicons
        name={listening ? 'mic' : 'mic-outline'}
        size={telegram ? 26 : 22}
        color={listening ? '#fff' : idleColor}
      />
      {listening ? <View style={styles.pulse} /> : null}
    </Pressable>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { backgroundColor: colors.primary + '22' },
  btnPressedTg: { opacity: 0.7 },
  btnActive: { backgroundColor: '#E53935' },
  btnDisabled: { opacity: 0.4 },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(229,57,53,0.45)',
  },
});
