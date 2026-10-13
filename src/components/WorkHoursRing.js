import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/**
 * Ажилласан цагийн цагираг (design §4 Ирц): 96px, 8px зузаан,
 * дэвсгэр `field`, явц `brand`. Дотор нь «0ц 00м» + «/ 8 цаг».
 *
 * `colors` өгвөл (хуучин дуудлага) түүнийг, үгүй бол токеныг ашиглана.
 */
export default function WorkHoursRing({
  workedMinutes = 0,
  targetMinutes = 480, // 8 цаг
  size = 96,
  stroke = 8,
}) {
  const { colors } = useTheme();
  const radius = (size - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = targetMinutes > 0 ? Math.min(1, workedMinutes / targetMinutes) : 0;
  const dash = circumference * ratio;

  const h = Math.floor(workedMinutes / 60);
  const m = Math.round(workedMinutes % 60);
  const targetH = Math.round(targetMinutes / 60);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.field} strokeWidth={stroke} fill="none" />
        {ratio > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.brand}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {h}ц {String(m).padStart(2, '0')}м
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '500' }}>/ {targetH} цаг</Text>
    </View>
  );
}
