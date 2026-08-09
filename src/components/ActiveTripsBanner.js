import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, useStyles } from '../context/ThemeContext';
import { fetchTripsWithPassengers } from '../services/vehicleService';
import { supabase } from '../lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Group chat дотор яг одоо ямар машинаар хэн гарсан, жолоочтой хамт яваа
// хүмүүсийг харуулна.
export default function ActiveTripsBanner() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [trips, setTrips] = useState([]);
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchTripsWithPassengers(120);
      setTrips((all || []).filter((t) => t.status === 'active'));
    } catch (e) {
      // чимээгүй алгасна
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const channel = supabase
      .channel('active-trips-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_passengers' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  if (!loaded || !trips.length) return null;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.bar} onPress={toggle} activeOpacity={0.75}>
        <View style={styles.barIcon}>
          <Ionicons name="car-sport" size={16} color="#fff" />
        </View>
        <Text style={styles.barTitle}>Гарсан машин</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{trips.length}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {open ? (
        <View style={styles.list}>
          {trips.map((t) => {
            const passengers = (t.passengers || []).filter((p) => (p.passenger_id || p.id) !== t.driver_id);
            return (
              <View key={t.id} style={styles.trip}>
                <View style={styles.plateBox}>
                  <Text style={styles.plateText}>{t.plate_number || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.driverRow}>
                    <Ionicons name="person-circle" size={16} color={colors.primary} />
                    <Text style={styles.driverName} numberOfLines={1}>
                      {t.driver_name || 'Жолооч'}
                    </Text>
                    <Text style={styles.driverTag}>жолооч</Text>
                  </View>
                  {passengers.length ? (
                    <View style={styles.paxRow}>
                      <Ionicons name="people" size={14} color={colors.textMuted} />
                      <Text style={styles.paxText} numberOfLines={2}>
                        {passengers.map((p) => p.passenger_name || p.name).join(', ')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.paxEmpty}>Дан жолооч</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    barIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    countPill: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    countText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    list: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
    trip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    plateBox: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 62,
      alignItems: 'center',
    },
    plateText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    driverName: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    driverTag: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: 'hidden',
    },
    paxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
    paxText: { color: colors.textMuted, fontSize: 13, flex: 1, lineHeight: 18 },
    paxEmpty: { color: colors.textFaint, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  });
