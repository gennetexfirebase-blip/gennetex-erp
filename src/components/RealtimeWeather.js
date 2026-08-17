/**
 * Бодит цагийн цаг агаар — нүүр дэлгэцийн толгой хэсэгт.
 *
 * ЗӨВХӨН ХАРАГДАЦ: эможи, температур, дэлгэрэнгүй цонх.
 * Байршил, татах, сэргээх, нөөц зам, алдаа — бүгд `useCurrentWeather`
 * hook дотор (src/hooks/useCurrentWeather.js).
 *
 * ХЭМЖЭЭ ТОГТМОЛ: ачаалж байх үед ч `☁️ --°` гэсэн ижил өргөнтэй
 * орлуулагч харуулна. Ингэснээр цаг агаар ирэхэд толгой хэсгийн бусад
 * элемент (нэр, цаг, зураг) байрнаасаа ҮСРЭХГҮЙ. Хуурамч эсвэл хуучин
 * температурыг ХЭЗЭЭ Ч урьдчилж харуулахгүй.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import useCurrentWeather from '../hooks/useCurrentWeather';

/**
 * WMO weather code → эможи.
 * https://open-meteo.com/en/docs — "Weather variable documentation"
 */
const ICONS = {
  0: '☀️',
  1: '🌤️', 2: '🌤️',
  3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌦️', 57: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const DESCRIPTIONS = {
  0: 'Цэлмэг',
  1: 'Багавтар үүлтэй', 2: 'Үүлшинэ',
  3: 'Үүлэрхэг',
  45: 'Манантай', 48: 'Манантай',
  51: 'Шиврээ бороо', 53: 'Шиврээ бороо', 55: 'Шиврээ бороо',
  56: 'Мөстөх шиврээ', 57: 'Мөстөх шиврээ',
  61: 'Бага зэргийн бороо', 63: 'Бороотой', 65: 'Их бороо',
  66: 'Мөстөх бороо', 67: 'Мөстөх бороо',
  71: 'Бага зэргийн цас', 73: 'Цастай', 75: 'Их цас', 77: 'Цасны ширхэг',
  80: 'Аадар бороо', 81: 'Аадар бороо', 82: 'Хүчтэй аадар',
  85: 'Цасан шуурга', 86: 'Цасан шуурга',
  95: 'Аянга цахилгаан', 96: 'Аянга, мөндөр', 99: 'Аянга, мөндөр',
};

const iconFor = (code) => ICONS[code] ?? '🌡️';
const describe = (code) => DESCRIPTIONS[code] ?? '—';

/** Байршил хаанаас гарсныг хэрэглэгчид ойлгомжтой хэлнэ. */
const PLACE_LABEL = {
  gps: 'Одоогийн байршил',
  cache: 'Сүүлд мэдэгдэж буй байршил',
  fallback: 'Улаанбаатар (ойролцоо)',
};

export default function RealtimeWeather({ style }) {
  const styles = useStyles(makeStyles);
  const { data, failed, source, reload } = useCurrentWeather();
  const [open, setOpen] = useState(false);

  const icon = data ? iconFor(data.code) : failed ? '' : '☁️';
  const temp = data ? `${data.temp}°` : '--°';

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.6 }, style]}
        onPress={() => (data ? setOpen(true) : reload())}
        accessibilityRole="button"
        accessibilityLabel={
          data ? `Цаг агаар ${data.temp} хэм, ${describe(data.code)}` : 'Цаг агаар ачаалж байна'
        }
        hitSlop={8}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.temp, !data && styles.tempDim]}>{temp}</Text>
      </Pressable>

      {/* Дэлгэрэнгүй — дарахад л гарна, толгой хэсгийн зайг эзлэхгүй */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardIcon}>{data ? iconFor(data.code) : '🌡️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardPlace}>{PLACE_LABEL[source] || 'Одоогийн байршил'}</Text>
                <Text style={styles.cardDesc}>{data ? describe(data.code) : '—'}</Text>
              </View>
              <Text style={styles.cardTemp}>{data ? `${data.temp}°` : '--°'}</Text>
            </View>

            <Row label="Температур" value={data ? `${data.temp}°C` : '—'} styles={styles} />
            <Row
              label="Мэдрэгдэх"
              value={data?.feels != null ? `${data.feels}°C` : '—'}
              styles={styles}
            />
            <Row
              label="Чийгшил"
              value={data?.humidity != null ? `${data.humidity}%` : '—'}
              styles={styles}
            />
            <Row
              label="Салхи"
              value={data?.wind != null ? `${data.wind} км/ц` : '—'}
              styles={styles}
            />

            <Text style={styles.cardHint}>10 минут тутам шинэчлэгдэнэ · Open-Meteo</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, value, styles }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Ачаалж байхад ч ижил өргөн эзэлж, layout үсрэхээс сэргийлнэ.
    minWidth: 62,
    justifyContent: 'center',
  },
  icon: { fontSize: 15 },
  temp: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  tempDim: { color: colors.textFaint },

  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.lg,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardIcon: { fontSize: 30 },
  cardPlace: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cardTemp: { color: colors.text, fontSize: 26, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  cardHint: { color: colors.textFaint, fontSize: 11, marginTop: spacing.md, textAlign: 'center' },
});
