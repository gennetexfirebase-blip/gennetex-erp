import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const WIDTH = 600;
const HEIGHT = 180;

export default function NativeSignaturePad({ onChange }) {
  const { colors } = useTheme();
  const [paths, setPaths] = useState([]);
  const pathsRef = useRef([]);
  const currentRef = useRef('');
  const sizeRef = useRef({ width: 1, height: 1 });

  const emit = (next) => {
    if (!next.length) {
      onChange?.('');
      return;
    }
    const body = next.map((d) => `<path d="${d}" fill="none" stroke="#16396f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    onChange?.(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`);
  };

  const point = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    return {
      x: Math.max(0, Math.min(WIDTH, locationX * WIDTH / sizeRef.current.width)),
      y: Math.max(0, Math.min(HEIGHT, locationY * HEIGHT / sizeRef.current.height)),
    };
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const p = point(event);
      currentRef.current = `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const next = [...pathsRef.current, currentRef.current];
      setPaths(next);
    },
    onPanResponderMove: (event) => {
      const p = point(event);
      currentRef.current += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const next = [...pathsRef.current, currentRef.current];
      setPaths(next);
    },
    onPanResponderRelease: () => {
      if (!currentRef.current) return;
      pathsRef.current = [...pathsRef.current, currentRef.current];
      currentRef.current = '';
      setPaths(pathsRef.current);
      emit(pathsRef.current);
    },
    onPanResponderTerminate: () => {
      if (currentRef.current) {
        pathsRef.current = [...pathsRef.current, currentRef.current];
        currentRef.current = '';
        setPaths(pathsRef.current);
        emit(pathsRef.current);
      }
    },
  }), []);

  const clear = () => {
    pathsRef.current = [];
    currentRef.current = '';
    setPaths([]);
    onChange?.('');
  };

  return (
    <View>
      <View
        {...responder.panHandlers}
        onLayout={(event) => { sizeRef.current = event.nativeEvent.layout; }}
        style={[styles.pad, { borderColor: colors.outlineVariant }]}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {paths.map((d, index) => <Path key={`${index}-${d.length}`} d={d} fill="none" stroke="#16396f" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{paths.length ? 'Гарын үсэг зурсан' : 'Энд гарын үсгээ зурна уу'}</Text>
        <TouchableOpacity onPress={clear}><Text style={[styles.clear, { color: colors.primary }]}>Цэвэрлэх</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { height: 180, backgroundColor: '#fff', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  hint: { fontSize: 12 },
  clear: { fontSize: 13, fontWeight: '700' },
});
