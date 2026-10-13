import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionTitle, formatMNT } from './ui';
import * as fuelApi from '../services/fuelPriceService';
import { friendlyError } from '../lib/erpMessages';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/**
 * Түлшний үнэ — БҮХ админ шинэчилж болно.
 *
 * ⚠️ Үнэ өөрчлөгдөх бүрд ХЭН НЭГЭН админ л оруулах ёстой. Тиймээс
 *    цэнэглэлт хийдэг дэлгэц дээрээ байрлана — ШТС-д очиж шинэ үнэ
 *    хараад тэр дороо оруулах боломжтой.
 *
 * Оруулсан утга нь `fuel_prices` дээр ОГНООТОЙ хадгалагдана: өмнөх
 * цэнэглэлтүүд өөрсдийн үеийн үнээ хадгалсаар үлдэнэ.
 */
export default function FuelPriceCard({ isAdmin, onChanged }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // fuel_type
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setPrices(await fuelApi.fetchCurrentPrices());
    } catch (e) {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (type, current) => {
    setEditing(type);
    setDraft(current ? String(Math.round(current)) : '');
  };

  const save = async () => {
    const price = Number(draft);
    if (!price || price <= 0) {
      Alert.alert('Анхаар', 'Үнээ зөв оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      await fuelApi.setPrice({ fuelType: editing, price });
      setEditing(null);
      setDraft('');
      await load();
      await onChanged?.();
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const byType = (t) => prices.find((p) => p.fuel_type === t);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>Түлшний үнэ · 1 литр</Text>
        <TouchableOpacity onPress={load} hitSlop={8} style={styles.roundBtn} accessibilityLabel="Шинэчлэх">
          <Ionicons name="refresh" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : (
        fuelApi.FUEL_TYPES.map((t) => {
          const row = byType(t.key);
          const isEditing = editing === t.key;
          return (
            <View key={t.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t.label}</Text>
                {row?.effective_date ? (
                  <Text style={styles.date}>{row.effective_date}-наас</Text>
                ) : (
                  <Text style={styles.date}>тохируулаагүй</Text>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={draft}
                    onChangeText={(v) => setDraft(v.replace(/[^\d]/g, ''))}
                    placeholder="3040"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.okBtn}
                    onPress={save}
                    disabled={saving}
                    hitSlop={6}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} hitSlop={6}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.valueBtn}
                  onPress={() => isAdmin && startEdit(t.key, row?.price_mnt)}
                  disabled={!isAdmin}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.value, !row && styles.valueMissing]}>
                    {row ? formatMNT(row.price_mnt) : '—'}
                  </Text>
                  {isAdmin ? (
                    <View style={styles.edBtn}>
                      <Ionicons name="pencil-outline" size={15} color={colors.muted} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  // Prototype «Түлшний үнэ · 1 литр» (.price)
  card: { backgroundColor: colors.card, borderRadius: 20, marginBottom: 12, ...shadow.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  headTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  roundBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  date: { color: colors.muted, fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },

  valueBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { color: colors.ink, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  valueMissing: { color: colors.muted },
  edBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: {
    width: 92,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.surface,
  },
  okBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hint: { color: colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: spacing.md },
});
