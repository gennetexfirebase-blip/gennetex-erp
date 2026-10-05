import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Gennetex ERP-ийн нэвтрэх/танилцуулгын үндсэн 3D дүрслэл.
 * Зураг файл ашиглахгүй тул бүх нягтаршил дээр цэвэр, ижил харагдана.
 */
export default function ErpIllustration({ compact = false, light = false }) {
  return (
    <View style={[styles.stage, compact && styles.stageCompact]} accessibilityElementsHidden>
      <View style={[styles.orbit, light && styles.orbitLight]} />
      <LinearGradient
        colors={light ? ['#dff5ff', '#8ed9ff'] : ['#57c9ff', '#087cff']}
        style={[styles.baseBack, compact && styles.baseBackCompact]}
      />
      <LinearGradient
        colors={light ? ['#bceaff', '#53baff'] : ['#6fd7ff', '#187ff4']}
        style={[styles.base, compact && styles.baseCompact]}
      />

      <View style={[styles.panel, styles.panelLeft, compact && styles.panelCompact]}>
        <Ionicons name="people" size={compact ? 20 : 25} color="#087cff" />
      </View>
      <View style={[styles.panel, styles.panelRight, compact && styles.panelCompact]}>
        <Ionicons name="menu" size={compact ? 22 : 28} color="#087cff" />
      </View>
      <View style={[styles.panel, styles.panelTop, compact && styles.panelCompact]}>
        <Ionicons name="bar-chart" size={compact ? 21 : 27} color="#087cff" />
      </View>

      <LinearGradient
        colors={['#4bbdff', '#087bff', '#0965e9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.erp, compact && styles.erpCompact]}
      >
        <Text style={[styles.erpText, compact && styles.erpTextCompact]}>ERP</Text>
      </LinearGradient>
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#006ee6', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 8 },
  default: {},
});

const styles = StyleSheet.create({
  stage: { width: 300, height: 235, alignItems: 'center', justifyContent: 'center' },
  stageCompact: { width: 230, height: 172 },
  orbit: { position: 'absolute', width: 286, height: 122, borderRadius: 150, borderWidth: 2, borderColor: 'rgba(255,255,255,0.48)', transform: [{ rotate: '-5deg' }] },
  orbitLight: { borderColor: 'rgba(22,135,245,0.22)' },
  baseBack: { position: 'absolute', bottom: 27, width: 204, height: 72, borderRadius: 26, transform: [{ rotate: '-4deg' }], opacity: 0.72 },
  baseBackCompact: { bottom: 20, width: 158, height: 54, borderRadius: 20 },
  base: { position: 'absolute', bottom: 40, width: 220, height: 77, borderRadius: 24, transform: [{ rotate: '4deg' }], ...shadow },
  baseCompact: { bottom: 29, width: 170, height: 58, borderRadius: 18 },
  panel: { position: 'absolute', width: 67, height: 67, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(230,248,255,0.94)', alignItems: 'center', justifyContent: 'center', ...shadow },
  panelCompact: { width: 52, height: 52, borderRadius: 14 },
  panelLeft: { left: 22, bottom: 46, transform: [{ rotate: '-7deg' }] },
  panelRight: { right: 20, top: 73, transform: [{ rotate: '6deg' }] },
  panelTop: { left: 37, top: 34, transform: [{ rotate: '-4deg' }] },
  erp: { width: 112, height: 125, borderRadius: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }], ...shadow },
  erpCompact: { width: 86, height: 96, borderRadius: 19 },
  erpText: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1.5, textShadowColor: 'rgba(0,48,130,0.28)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  erpTextCompact: { fontSize: 26 },
});
