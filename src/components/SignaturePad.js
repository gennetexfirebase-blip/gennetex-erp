import React, { useRef, useState, useCallback } from 'react';
import { View, PanResponder, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const VIEW_W = 600;
const VIEW_H = 220;

export function pathsToSvg(paths, width = VIEW_W, height = VIEW_H) {
  const lines = paths
    .filter((p) => p.length > 1)
    .map(
      (p) =>
        `<path d="${p.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#111827" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines}</svg>`;
}

export default function SignaturePad({ onChange }) {
  const [paths, setPaths] = useState([]);
  const current = useRef([]);
  const pathsRef = useRef([]);
  const layout = useRef({ width: 300, height: 220 });
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const scalePoint = useCallback((x, y) => {
    const { width, height } = layout.current;
    if (!width || !height) return { x, y };
    return {
      x: (x / width) * VIEW_W,
      y: (y / height) * VIEW_H,
    };
  }, []);

  const emitChange = useCallback(
    (nextPaths) => {
      onChange?.(nextPaths.length ? pathsToSvg(nextPaths) : '');
    },
    [onChange]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current = [scalePoint(locationX, locationY)];
        setPaths([...pathsRef.current, current.current]);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current = [...current.current, scalePoint(locationX, locationY)];
        setPaths([...pathsRef.current, current.current]);
      },
      onPanResponderRelease: () => {
        if (current.current.length > 1) {
          pathsRef.current = [...pathsRef.current, current.current];
          setPaths([...pathsRef.current]);
          emitChange(pathsRef.current);
        }
        current.current = [];
      },
    })
  ).current;

  const clear = () => {
    pathsRef.current = [];
    current.current = [];
    setPaths([]);
    emitChange([]);
  };

  return (
    <View>
      <Text style={styles.label}>Гарын үсэг (анхны тайлан дээр заавал)</Text>
      <View
        style={styles.pad}
        onLayout={(e) => {
          layout.current = e.nativeEvent.layout;
        }}
        {...pan.panHandlers}
      >
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} pointerEvents="none">
          {paths.map((p, i) => (
            <Path
              key={i}
              d={p.map((pt, j) => `${j === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ')}
              stroke={colors.text}
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
      <Text style={styles.clear} onPress={clear}>
        Цэвэрлэх
      </Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  pad: {
    height: VIEW_H,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    overflow: 'hidden',
  },
  clear: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: spacing.sm, textAlign: 'right' },
});
