import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from './ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

// Дэмжих зураасан кодын төрлүүд
const BARCODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code128',
  'code93',
  'itf14',
  'codabar',
];

export default function BarcodeScanner({ visible, onClose, onScanned, title, hint, frameWidth = 280, frameHeight = 180 }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const styles = useStyles(makeStyles);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const handleScanned = ({ data, type }) => {
    if (scanned) return;
    setScanned(true);
    onScanned?.(data, type);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Камерын зөвшөөрлийг шалгаж байна...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>
              Зураасан код уншихын тулд камерын зөвшөөрөл шаардлагатай.
            </Text>
            <Button title="Зөвшөөрөл олгох" onPress={requestPermission} />
            <Button
              title="Хаах"
              variant="ghost"
              style={{ marginTop: spacing.md }}
              onPress={onClose}
            />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View style={styles.overlay} pointerEvents="none">
              {title ? <Text style={styles.title}>{title}</Text> : null}
              <View style={[styles.frame, { width: frameWidth, height: frameHeight, borderRadius: frameWidth === frameHeight ? 20 : 16 }]} />
              <Text style={styles.hint}>{hint || 'Кодыг хүрээн дунд байрлуулна уу'}</Text>
            </View>
            <View style={styles.controls}>
              {scanned && (
                <Button
                  title="Дахин унших"
                  variant="ghost"
                  style={{ marginBottom: spacing.md }}
                  onPress={() => setScanned(false)}
                />
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>Хаах</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000'},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  msg: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.md,
    backgroundColor: '#00000088',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  hint: {
    color: '#fff',
    marginTop: spacing.lg,
    fontSize: 15,
    backgroundColor: '#00000088',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  closeBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 30,
  },
  closeText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
