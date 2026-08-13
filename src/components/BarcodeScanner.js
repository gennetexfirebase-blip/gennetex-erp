import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

// Дэмжих зураасан кодын төрлүүд.
// `datamatrix` болон `pdf417` нэмэгдсэн: сүлжээний төхөөрөмжийн (ONT, router)
// MAC/SN наалт дээр эдгээр формат түгээмэл байдаг.
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
  'datamatrix',
  'pdf417',
];

/**
 * Нэг код унших сканнер.
 *
 * Утасны өөрийн сканнертай ижил төрхтэй: бүрэн харанхуй дэвсгэр,
 * дугуй булантай 4 өнцөг, доор гар чийдэн. Хуучин хувилбар нь бүтэн
 * хүрээ + том текст блокуудтай байсан нь камерын дүрсийг халхалдаг байв.
 *
 * Олон код дараалан унших шаардлагатай бол `MultiScanSheet` ашиглана.
 */
export default function BarcodeScanner({
  visible,
  onClose,
  onScanned,
  title,
  hint,
  frameWidth = 240,
  frameHeight = 240,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const styles = useStyles(makeStyles);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorch(false);
    }
  }, [visible]);

  const handleScanned = ({ data, type }) => {
    if (scanned) return;
    setScanned(true);
    onScanned?.(data, type);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
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
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />

            {/* Дээд мөр */}
            <View style={styles.top} pointerEvents="box-none">
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              {title ? (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={styles.iconBtn} />
            </View>

            {/* Хүрээ — дугуй булантай 4 өнцөг */}
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={{ width: frameWidth, height: frameHeight }}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
              <Text style={styles.hint}>{hint || 'Кодыг хүрээн дунд байрлуулна уу'}</Text>
            </View>

            {/* Доод хяналт */}
            <View style={styles.controls}>
              {scanned ? (
                <TouchableOpacity style={styles.rescan} onPress={() => setScanned(false)}>
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.rescanText}>Дахин унших</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.torch, torch && styles.torchOn]}
                onPress={() => setTorch((t) => !t)}
                accessibilityRole="button"
                accessibilityLabel="Гар чийдэн"
              >
                <Ionicons
                  name={torch ? 'flashlight' : 'flashlight-outline'}
                  size={24}
                  color={torch ? '#111' : '#fff'}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
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

    top: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 28,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      zIndex: 2,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },

    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    corner: { position: 'absolute', width: 46, height: 46, borderColor: '#fff', borderWidth: 5 },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 22 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 22 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 22 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 22 },
    hint: {
      color: 'rgba(255,255,255,0.92)',
      marginTop: spacing.xl,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },

    controls: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 56 : 36,
      left: 0,
      right: 0,
      alignItems: 'center',
      gap: spacing.md,
    },
    torch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    torchOn: { backgroundColor: '#fff' },
    rescan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    rescanText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });
