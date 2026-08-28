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
    <Card>
      <View style={styles.head}>
        <SectionTitle style={{ marginBottom: 0 }}>Түлшний үнэ (1 литр)</SectionTitle>
        <TouchableOpacity onPress={load} hitSlop={8}>
          <Ionicons name="refresh" size={17} color={colors.textMuted} />
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
                    <Ionicons name="create-outline" size={15} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <Text style={styles.hint}>
        {isAdmin
          ? 'Үнэ солигдсон бол энд шинэчилнэ — бүх админд шууд харагдана. Өмнөх цэнэглэлтүүд өөрсдийн үеийн үнээ хадгална.'
          : 'Түлшний үнийг зөвхөн админ шинэчилнэ.'}
      </Text>
    </Card>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  valueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { color: colors.text, fontSize: 16, fontWeight: '800' },
  valueMissing: { color: colors.textMuted },

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
