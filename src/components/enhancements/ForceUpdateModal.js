import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { checkAppUpdate, openStoreUrl } from '../../services/appUpdateService';
import { darkColors } from '../../theme/tokens';
import { loadFeatureFlagOverrides } from '../../lib/featureFlags';

const c = darkColors;

export default function ForceUpdateModal() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadFeatureFlagOverrides();
      try {
        const res = await checkAppUpdate();
        if (active && res) setInfo(res);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!info) return null;

  return (
    <Modal visible animationType="fade" transparent={!info.force}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.badge}>{info.force ? 'ШААРДЛАГАТАЙ' : 'ШИНЭЧЛЭЛТ'}</Text>
          <Text style={styles.title}>Шинэ хувилбар бэлэн</Text>
          <Text style={styles.sub}>{info.message}</Text>
          <Text style={styles.ver}>
            Одоо: v{info.currentVersion} → Шинэ: v{info.latestVersion}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => openStoreUrl(info.storeUrl)} activeOpacity={0.85}>
            <Text style={styles.btnText}>Шинэчлэх</Text>
          </TouchableOpacity>
          {!info.force ? (
            <TouchableOpacity style={styles.later} onPress={() => setInfo(null)}>
              <Text style={styles.laterText}>Дараа</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(1,15,31,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  badge: {
    alignSelf: 'flex-start',
    color: c.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  ver: { color: c.textFaint, fontSize: 12, marginBottom: 20 },
  btn: {
    backgroundColor: c.primaryContainer,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: c.onPrimaryContainer, fontWeight: '800', fontSize: 16 },
  later: { marginTop: 14, alignItems: 'center' },
  laterText: { color: c.textMuted, fontWeight: '600' },
});
