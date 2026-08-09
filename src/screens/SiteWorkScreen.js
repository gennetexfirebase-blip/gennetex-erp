import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, ScreenHeader, SectionTitle, Badge } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as siteWorkApi from '../services/siteWorkService';
import { elapsedSeconds, formatDuration } from '../lib/online';

export default function SiteWorkScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, isCloud } = useApp();
  const [ctx, setCtx] = useState(null);
  const [session, setSession] = useState(null);
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [workNote, setWorkNote] = useState('');
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud || !currentUser?.id) return;
    try {
      const tripCtx = await siteWorkApi.fetchActiveTripContext(currentUser.id);
      setCtx(tripCtx);
      if (tripCtx?.trip?.id) {
        const s = await siteWorkApi.fetchSessionForTrip(tripCtx.trip.id);
        setSession(s);
        if (s?.site_name) setSiteName(s.site_name);
        if (s?.site_address) setSiteAddress(s.site_address || '');
        if (s?.work_note) setWorkNote(s.work_note);
      }
    } catch (e) {}
  }, [isCloud, currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (session?.status !== 'on_site') return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [session?.status, session?.arrived_at]);

  const durationSec =
    session?.status === 'on_site'
      ? elapsedSeconds(session.arrived_at)
      : session?.arrived_at && session?.departed_at
        ? elapsedSeconds(session.arrived_at, session.departed_at)
        : 0;

  const passengers = ctx?.passengers || session?.passengers || [];
  const isDriver = ctx?.role === 'driver';
  const canControl = isDriver && ctx?.trip;

  const handleArrive = async () => {
    if (!siteName.trim()) {
      Alert.alert('Анхаар', 'Ажлын байрын нэр оруулна уу.');
      return;
    }
    if (!ctx?.trip) {
      Alert.alert('Анхаар', 'Идэвхтэй баг/аялал байхгүй. Эхлээд машины QR уншуулна уу.');
      return;
    }
    setLoading(true);
    try {
      const s = await siteWorkApi.markArrival({
        trip: ctx.trip,
        driverId: currentUser.id,
        driverName: authProfile?.name || currentUser.name,
        siteName,
        siteAddress,
        passengers,
      });
      setSession(s);
      Alert.alert('Бүртгэгдлээ', 'Ажлын байр дээр очсон цаг эхэллээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepart = async () => {
    if (!session?.id) return;
    setLoading(true);
    try {
      const s = await siteWorkApi.markDeparture(session.id);
      setSession(s);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!session?.id) return;
    if (!workNote.trim()) {
      Alert.alert('Анхаар', 'Хийсэн ажлын тайлбар бичнэ үү.');
      return;
    }
    setLoading(true);
    try {
      const s = await siteWorkApi.submitWorkReport(session.id, workNote);
      setSession(s);
      Alert.alert('Илгээгдлээ', 'Админд ажлын тайлан хүрлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажлын байр" subtitle="Баг · цаг хяналт"/>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {!ctx?.trip ? (
          <Card>
            <Text style={styles.help}>
              Идэвхтэй баг байхгүй байна. Жолооч эхлээд машины QR уншиж, хамт яваа хүмүүсийг бүртгээд аялал эхлүүлнэ.
            </Text>
          </Card>
        ) : (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.tripTitle}>{ctx.trip.plate_number || 'Машин'}</Text>
              <Badge text="Идэвхтэй баг" color={colors.success} />
            </View>
            <Text style={styles.meta}>Жолооч: {ctx.trip.driver_name || '—'}</Text>
            <Text style={styles.meta}>Таны үүрэг: {isDriver ? 'Жолооч' : 'Хамт явагч'}</Text>
          </Card>
        )}

        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle>Багийн гишүүд</SectionTitle>
          <View style={styles.driverBlock}>
            <Text style={styles.driverLabel}>Жолооч</Text>
            <Text style={styles.driverName}>{ctx?.trip?.driver_name || '—'}</Text>
          </View>
          {passengers.length === 0 ? (
            <Text style={styles.muted}>Хамт яваа хүн бүртгэгдээгүй</Text>
          ) : (
            passengers.map((p) => (
              <View key={p.passenger_id || p.id} style={styles.passengerRow}>
                <Text style={styles.passengerName}>• {p.passenger_name || p.name}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle>Ажлын байр</SectionTitle>
          <Field
            label="Байршил / объектын нэр"
            placeholder="Ж: 12-р хороо, шинэ айл"
            value={siteName}
            onChangeText={setSiteName}
            editable={canControl && session?.status !== 'submitted'}
          />
          <Field
            label="Хаяг (заавал биш)"
            placeholder="Дэлгэрэнгүй хаяг"
            value={siteAddress}
            onChangeText={setSiteAddress}
            editable={canControl && session?.status !== 'submitted'}
          />

          {session?.arrived_at ? (
            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>
                {session.status === 'on_site' ? 'Байр дээр байгаа цаг' : 'Нийт хугацаа'}
              </Text>
              <Text style={styles.timerValue}>{formatDuration(durationSec)}</Text>
              <Text style={styles.timerSub}>
                Очсон: {new Date(session.arrived_at).toLocaleTimeString('mn-MN')}
                {session.departed_at
                  ? ` · Явсан: ${new Date(session.departed_at).toLocaleTimeString('mn-MN')}`
                  : ''}
              </Text>
            </View>
          ) : null}

          {canControl && session?.status !== 'submitted' ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {!session || session.status === 'pending' ? (
                <Button title="Очсон" variant="success" onPress={handleArrive} disabled={loading} />
              ) : null}
              {session?.status === 'on_site' ? (
                <Button title="Явлаа" variant="warning" onPress={handleDepart} disabled={loading} />
              ) : null}
              {session?.status === 'left' || session?.status === 'on_site' ? (
                <>
                  <Field
                    label="Хийсэн ажлын тайлбар"
                    placeholder="Юу хийсэнээ бичнэ үү..."
                    value={workNote}
                    onChangeText={setWorkNote}
                    multiline
                  />
                  {session.status === 'left' ? (
                    <Button title="Админд илгээх" onPress={handleSubmit} disabled={loading} />
                  ) : null}
                </>
              ) : null}
            </View>
          ) : !canControl && session ? (
            <Text style={styles.muted}>Жолооч ажлын байрын цагийг бүртгэнэ.</Text>
          ) : null}

          {session?.status === 'submitted' ? (
            <Badge text="Админд илгээгдсэн" color={colors.primary} />
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  help: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  tripTitle: { color: colors.text, fontSize: 18, fontWeight: '800'},
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  driverBlock: { marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  driverLabel: { color: colors.textMuted, fontSize: 12 },
  driverName: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  passengerRow: { paddingVertical: 4 },
  passengerName: { color: colors.text, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  timerBox: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  timerLabel: { color: colors.textMuted, fontSize: 12 },
  timerValue: { color: colors.primary, fontSize: 28, fontWeight: '900', marginTop: 4 },
  timerSub: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
});
