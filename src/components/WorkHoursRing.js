import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * Ажилласан цагийн дугуй прогресс.
 *
 * `react-native-svg` нь төсөлд аль хэдийн суусан (QR код зэрэгт
 * ашигладаг) тул шинэ хамаарал нэмэхгүйгээр ашиглав.
 */
export default function WorkHoursRing({
  workedMinutes = 0,
  targetMinutes = 480, // 8 цаг
  size = 118,
  stroke = 9,
  colors,
  label = 'Нийт ажилласан',
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = targetMinutes > 0 ? Math.min(1, workedMinutes / targetMinutes) : 0;
  const dash = circumference * ratio;

  const h = Math.floor(workedMinutes / 60);
  const m = Math.round(workedMinutes % 60);
  const timeText = workedMinutes > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : '--:--';

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {/* Далд суурь цагираг */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceContainerHigh}
            strokeWidth={stroke}
            fill="none"
          />
          {/* Явц — 12 цагаас эхэлж цагийн зүүний дагуу */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* Шошго нь цагиргийн ДОТОР — загварын дагуу */}
        <View style={{ alignItems: 'center', paddingHorizontal: 6 }}>
          <Text
            style={{ color: colors.textMuted, fontSize: 10, textAlign: 'center' }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 1 }}>
            {timeText}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 10 }}>цаг</Text>
        </View>
      </View>
    </View>
  );
}
