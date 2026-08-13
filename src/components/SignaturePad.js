import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/**
 * Гарын үсэг зурах самбар.
 *
 * ӨМНӨХ АЛДАА (зассан):
 *   viewBox нь 600×220 тогтмол байсан атлаа самбар нь дэлгэцийн өргөнөөр
 *   (жишээ нь 350×220) зурагддаг байв. SVG-ийн `preserveAspectRatio`
 *   анхдагчаараа "meet" — өөрөөр хэлбэл агуулгыг багтаахын тулд
 *   min(350/600, 220/220) = 0.58 дахин ЖИЖИГРҮҮЛЖ, дараа нь босоо
 *   тэнхлэгт ГОЛЛУУЛДАГ. Гэтэл хүрэлтийн цэгийг шугаман хөрвүүлж
 *   байсан тул зураас хуруунаас ~46px зөрж, дээш доош "гүйдэг" байв.
 *
 * ШИЙДЭЛ:
 *   viewBox-ыг самбарын БОДИТ пикселийн хэмжээтэй тэнцүү болгов —
 *   ингэснээр ямар ч масштаблалт хийгдэхгүй, зураас яг хурууны доор
 *   гарна. Хэмжээ өөрчлөлт нь зөвхөн ЭКСПОРТ дээр, харьцааг хадгалж
 *   хийгдэнэ.
 */

/** Экспортын өргөн — өндөр нь самбарын харьцаагаар тооцогдоно. */
const EXPORT_W = 600;

/**
 * Зурсан замуудыг SVG болгоно.
 *
 * @param {Array<Array<{x:number,y:number}>>} paths  самбарын пикселээр
 * @param {number} padW  самбарын бодит өргөн
 * @param {number} padH  самбарын бодит өндөр
 */
export function pathsToSvg(paths, padW = EXPORT_W, padH = 220, stroke = '#111827') {
  const drawn = (paths || []).filter((p) => p.length > 0);
  if (!drawn.length) return '';

  // Харьцааг хадгалж экспортын хэмжээ рүү шилжүүлнэ
  const scale = padW ? EXPORT_W / padW : 1;
  const outH = Math.round((padH || 220) * scale);

  const body = drawn
    .map((p) => {
      const d = p
        .map((pt, i) => `${i === 0 ? 'M' : 'L'}${(pt.x * scale).toFixed(1)} ${(pt.y * scale).toFixed(1)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EXPORT_W} ${outH}" width="${EXPORT_W}" height="${outH}">${body}</svg>`;
}

export default function SignaturePad({
  onChange,
  height = 220,
  strokeColor,
  label = 'Гарын үсэг',
  exportStroke = '#111827',
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ width: 0, height });

  const pathsRef = useRef([]);
  const currentRef = useRef([]);
  const sizeRef = useRef({ width: 0, height });

  // PanResponder нэг л удаа үүсдэг тул callback-уудыг ref-ээр барина.
  // Эс тэгвээс эцэг компонент шинэ `onChange` дамжуулахад хуучин нь
  // хадгалагдаж, гарын үсэг хадгалагдахгүй үлдэнэ.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const strokeRef = useRef(exportStroke);
  strokeRef.current = exportStroke;

  const emit = useCallback((next) => {
    const { width, height: h } = sizeRef.current;
    onChangeRef.current?.(next.length ? pathsToSvg(next, width, h, strokeRef.current) : '');
  }, []);

  /**
   * Хүрэлтийн цэгийг самбарын хүрээнд барина.
   *
   * `locationX/Y` нь хүрсэн VIEW-д харьцангуй. Доторх Svg дээр
   * `pointerEvents="none"` тавьсан тул хүрэлт үргэлж самбар дээр
   * бүртгэгдэнэ. Хязгаарлалт нь хуруу гадагш гарахад зураас
   * самбараас гарахаас сэргийлнэ.
   */
  const point = useCallback((e) => {
    const { width, height: h } = sizeRef.current;
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    return {
      x: Math.max(0, Math.min(width || 0, x)),
      y: Math.max(0, Math.min(h || 0, y)),
    };
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Самбар ScrollView дотор байхад гүйлгэлт зурахыг тасалдуулах
        // ёсгүй — хүрсэн цагт бид хариуцна.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (e) => {
          currentRef.current = [point(e)];
          setPaths([...pathsRef.current, currentRef.current]);
        },
        onPanResponderMove: (e) => {
          currentRef.current = [...currentRef.current, point(e)];
          setPaths([...pathsRef.current, currentRef.current]);
        },
        onPanResponderRelease: () => {
          // Нэг цэг (цэг тавих) ч гарын үсгийн хэсэг байж болно —
          // өмнө нь 1 цэгтэй замыг хаядаг байв.
          if (currentRef.current.length) {
            pathsRef.current = [...pathsRef.current, currentRef.current];
            setPaths([...pathsRef.current]);
            emit(pathsRef.current);
          }
          currentRef.current = [];
        },
      }),
    [point, emit]
  );

  const clear = () => {
    pathsRef.current = [];
    currentRef.current = [];
    setPaths([]);
    emit([]);
  };

  const stroke = strokeColor || colors.text;
  const hasInk = paths.some((p) => p.length > 0);

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {hasInk ? (
          <TouchableOpacity onPress={clear} hitSlop={10} accessibilityRole="button">
            <Text style={styles.clear}>Цэвэрлэх</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[styles.pad, { height }]}
        onLayout={(e) => {
          const { width, height: h } = e.nativeEvent.layout;
          sizeRef.current = { width, height: h };
          setSize({ width, height: h });
        }}
        {...pan.panHandlers}
      >
        {/* viewBox нь самбарын бодит хэмжээтэй ЯГ тэнцүү — масштаблалт
            хийгдэхгүй тул зураас хурууны яг доор гарна. */}
        {size.width > 0 ? (
          <Svg
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            pointerEvents="none"
          >
            {paths.map((p, i) => (
              <Path
                key={i}
                d={
                  p.length === 1
                    ? `M${p[0].x} ${p[0].y} L${p[0].x + 0.1} ${p[0].y}`
                    : p.map((pt, j) => `${j === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ')
                }
                stroke={stroke}
                strokeWidth={2.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        ) : null}

        {!hasInk ? (
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>Энд хуруугаараа гарын үсгээ зурна уу</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    clear: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    pad: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.bgAlt,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    hintWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    hint: { color: colors.textFaint, fontSize: 13 },
  });
