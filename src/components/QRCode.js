import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

// Цэвэр JS-ээр QR матриц үүсгээд react-native-svg дээр зурна.
// (react-native-qrcode-svg → css-tree Metro-д эвдэрдэг тул үүнийг ашиглана.)
export default function QRCode({ value, size = 220, color = '#000', background = '#fff'}) {
  const cells = useMemo(() => {
    if (!value) return null;
    const qr = qrcode(0, 'M'); // 0 = авто хэмжээ, 'M' = алдаа засах түвшин
    qr.addData(String(value));
    qr.make();
    const count = qr.getModuleCount();
    const rects = [];
    const cell = size / count;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          rects.push(
            <Rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell + 0.5}
              height={cell + 0.5}
              fill={color}
            />
          );
        }
      }
    }
    return rects;
  }, [value, size, color]);

  if (!cells) return null;

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill={background} />
      {cells}
    </Svg>
  );
}
