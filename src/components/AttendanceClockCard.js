import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import WorkHoursRing from './WorkHoursRing';
import SlideToConfirm, { SlideDone } from './SlideToConfirm';
import { Box, Chip } from './ds';

const WD = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
const p2 = (n) => String(n).padStart(2, '0');

function hm(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/**
 * «Өнөөдрийн ирц» том карт (design §4 Ирц).
 *
 * Том цаг (`--:--` үед бүдэг), төлөвийн chip, ажилласан цагийн цагираг,
 * Ирсэн/Явсан, байршил + «Бүсэд байна», ажлын цаг, чирдэг товч.
 * Ирц бүртгэх логик нь дуудагч талд (`onCheckIn` / `onCheckOut`).
 */
export default function AttendanceClockCard({
  shiftStatus = {},
  busy,
  onCheckIn,
  onCheckOut,
  targetMinutes = 480,
  locationName,
  locationDistance,
  locationWithin,
  locationNote,
  workHoursText,
  footer,
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const now = new Date();
  const inAt = hm(shiftStatus.checkInAt);
  const outAt = hm(shiftStatus.checkOutAt);

  const worked = (() => {
    if (!shiftStatus.checkInAt) return 0;
    const end = shiftStatus.checkOutAt ? new Date(shiftStatus.checkOutAt) : now;
    return Math.max(0, Math.round((end - new Date(shiftStatus.checkInAt)) / 60000));
  })();

  const status = shiftStatus.checkedOut
    ? { text: 'Ажил дууссан', tone: 'ok', icon: 'checkmark-circle' }
    : shiftStatus.checkedIn
      ? { text: 'Ажил дээр', tone: 'ok', icon: 'ellipse' }
      : { text: 'Бүртгүүлээгүй', tone: 'warn', icon: 'alert-circle' };

  const big = shiftStatus.checkedOut ? outAt : inAt;

  return (
    <Box style={styles.clock}>
      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.lbl}>
            Өнөөдрийн ирц · {WD[now.getDay()]}, {p2(now.getMonth() + 1)}.{p2(now.getDate())}
          </Text>
          <Text style={[styles.big, !big && styles.bigEmpty]}>{big || '--:--'}</Text>
          <Chip text={status.text} tone={status.tone} icon={status.icon} />
        </View>
        <WorkHoursRing workedMinutes={worked} targetMinutes={targetMinutes} />
      </View>

      <View style={styles.io}>
        <View style={styles.ioCell}>
          <View style={[styles.ioIc, { backgroundColor: colors.okSoft }]}>
            <Ionicons name="log-in-outline" size={17} color={colors.ok} />
          </View>
          <View>
            <Text style={styles.ioLbl}>Ирсэн</Text>
            <Text style={[styles.ioVal, !inAt && styles.ioEmpty]}>{inAt || '--:--'}</Text>
          </View>
        </View>
        <View style={[styles.ioCell, styles.ioRight]}>
          <View style={[styles.ioIc, { backgroundColor: colors.badSoft }]}>
            <Ionicons name="log-out-outline" size={17} color={colors.bad} />
          </View>
          <View>
            <Text style={styles.ioLbl}>Явсан</Text>
            <Text style={[styles.ioVal, !outAt && styles.ioEmpty]}>{outAt || '--:--'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.meta}>
        {locationName || locationNote ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {locationName ? <Text style={styles.metaStrong}>{locationName}</Text> : null}
              {locationName && locationDistance != null ? ` · ${locationDistance} м зайд` : ''}
              {!locationName ? locationNote : ''}
            </Text>
            {locationWithin != null ? (
              <Chip text={locationWithin ? 'Бүсэд байна' : 'Бүсээс гадна'} tone={locationWithin ? 'ok' : 'warn'} />
            ) : null}
          </View>
        ) : null}
        {workHoursText ? (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              Ажлын цаг <Text style={styles.metaStrong}>{workHoursText}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      {shiftStatus.checkedOut ? (
        <SlideDone />
      ) : !shiftStatus.checkedIn ? (
        <SlideToConfirm label="Ирлээ" direction="right" loading={busy} onConfirm={onCheckIn} />
      ) : (
        <SlideToConfirm label="Явлаа" direction="left" loading={busy} onConfirm={onCheckOut} />
      )}
      {footer}
    </Box>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    clock: { padding: 18 },
    top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    lbl: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    big: { color: colors.ink, fontSize: 46, fontWeight: '700', letterSpacing: -1.2, fontVariant: ['tabular-nums'], lineHeight: 50, marginTop: 6, marginBottom: 10 },
    bigEmpty: { color: colors.faint, letterSpacing: 1 },
    io: { flexDirection: 'row', marginTop: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 14 },
    ioCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
    ioRight: { borderLeftWidth: 1, borderLeftColor: colors.line },
    ioIc: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    ioLbl: { color: colors.muted, fontSize: 12 },
    ioVal: { color: colors.ink, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
    ioEmpty: { color: colors.faint },
    meta: { gap: 8, marginTop: 14, marginBottom: 16 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaText: { flex: 1, color: colors.muted, fontSize: 13.5 },
    metaStrong: { color: colors.ink, fontWeight: '600' },
  });
