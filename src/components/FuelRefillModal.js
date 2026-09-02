import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMNT } from './ui';
import * as fuelApi from '../services/fuelPriceService';
import { friendlyError } from '../lib/erpMessages';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const QUICK_AMOUNTS = [20000, 30000, 50000, 100000];

/**
 * Түлш цэнэглэх — админ ЗӨВХӨН МӨНГӨН ДҮНГЭЭ оруулна.
 *
 * Литр нь тухайн үеийн 1 литрийн үнээр тооцогдоно. Тооцоог СЕРВЕР
 * хийдэг (`refuel_vehicle_by_amount`) — энд харуулж буй тоо нь зөвхөн
 * урьдчилсан таамаг. Ингэснээр хоцрогдсон үнэтэй утаснаас буруу литр
 * бүртгэгдэхээс сэргийлнэ.
 */
export default function FuelRefillModal({ visible, vehicle, onClose, onDone }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(null);

  /**
   * Хөнгөлөлтийн карт.
   *
   * ⚠️ Байгууллагын карттай үед станц литрийн үнийг хөнгөлдөг. Систем
   *    зөвхөн НИЙТИЙН үнээр боддог байсан тул хөнгөлөлттэй авахад
   *    бодит литрээс ЦӨӨН литр бүртгэгдэж, сав дүүрсэн ч систем
   *    "дутуу" гэж харуулдаг байв.
   */
  const [hasCard, setHasCard] = useState(false);
  const [cardPrice, setCardPrice] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [saving, setSaving] = useState(false);

  const fuelType = vehicle?.fuel_type || 'ai92';

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setHasCard(false);
    setCardPrice('');
    setSaving(false);
    setLoadingPrice(true);
    fuelApi
      .fetchPrice(fuelType)
      .then(setPrice)
      .catch(() => setPrice(null))
      .finally(() => setLoadingPrice(false));
  }, [visible, fuelType]);

  const amountNum = Number(String(amount).replace(/[^\d]/g, '')) || 0;
  const cardPriceNum = Number(String(cardPrice).replace(/[^0-9]/g, '')) || 0;

  // Хөнгөлөлт идэвхтэй БА үнэ бичигдсэн үед л түүгээр тооцно.
  const effectivePrice = hasCard && cardPriceNum ? cardPriceNum : price;

  const liters = useMemo(
    () => (effectivePrice && amountNum ? amountNum / effectivePrice : 0),
    [effectivePrice, amountNum]
  );
  const saved = hasCard && cardPriceNum && price ? Math.round((price - cardPriceNum) * liters) : 0;

  const submit = async () => {
    if (!amountNum) {
      Alert.alert('Анхаар', 'Мөнгөн дүнгээ оруулна уу.');
      return;
    }
    if (!price) {
      Alert.alert(
        'Үнэ алга',
        `${fuelApi.fuelTypeLabel(fuelType)}-ийн 1 литрийн үнэ бүртгэгдээгүй байна.\n\n` +
          'Тохиргоо → Түлшний үнэ хэсгээс оруулна уу.'
      );
      return;
    }
    if (hasCard && !cardPriceNum) {
      Alert.alert('Анхаар', 'Хөнгөлөлттэй үнээ оруулна уу.');
      return;
    }
    if (hasCard && cardPriceNum > price) {
      Alert.alert(
        'Буруу үнэ',
        'Хөнгөлсөн үнэ нийтийн үнээс (' + formatMNT(price) + ') их байж болохгүй. ' +
          'Нийт төлсөн дүнг биш, 1 ЛИТРИЙН үнийг бичнэ үү.'
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fuelApi.refuelByAmount({
        vehicleId: vehicle.id,
        amountMnt: amountNum,
        pricePerLiter: hasCard ? cardPriceNum : null,
      });
      onClose?.();
      await onDone?.();
      Alert.alert(
        'Цэнэглэлээ',
        `${vehicle.plate_number}\n` +
          `${formatMNT(amountNum)} → ${res.liters.toFixed(2)} л\n` +
          `1 литр = ${formatMNT(res.pricePerLiter)}\n` +
          `Савны түвшин: ${res.fuelLevelPercent}%`
      );
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Түлш цэнэглэх</Text>
              <Text style={styles.sub}>
                {vehicle.plate_number} · {fuelApi.fuelTypeLabel(fuelType)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={saving}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Одоогийн үнэ — тооцоо юунаас гарч байгаа нь ил байх ёстой. */}
            <View style={styles.priceBox}>
              {loadingPrice ? (
                <ActivityIndicator color={colors.primary} />
              ) : price ? (
                <>
                  <Text style={styles.priceLabel}>1 литрийн үнэ</Text>
                  <Text style={styles.priceValue}>{formatMNT(price)}</Text>
                </>
              ) : (
                <Text style={styles.priceMissing}>
                  Үнэ бүртгэгдээгүй — Тохиргоо → Түлшний үнэ хэсгээс оруулна уу.
                </Text>
              )}
            </View>

            <Text style={styles.label}>Мөнгөн дүн (₮)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
              placeholder="50000"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={styles.quickChip}
                  onPress={() => setAmount(String(a))}
                >
                  <Text style={styles.quickText}>{(a / 1000).toFixed(0)}мянга</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Хөнгөлөлтийн карт ──────────────────────────────
                ⚠️ Байгууллагын карттай үед станц литрийн үнийг
                   хөнгөлдөг. Системд зөвхөн нийтийн үнэ байсан тул
                   хөнгөлөлттэй авахад бодит литрээс ЦӨӨН литр
                   бүртгэгдэж, сав дүүрсэн ч "дутуу" гэж харагддаг
                   байв. */}
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => setHasCard((v) => !v)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={hasCard ? 'checkbox' : 'square-outline'}
                size={22}
                color={hasCard ? colors.primary : colors.textMuted}
              />
              <Text style={styles.cardLabel}>Хөнгөлөлтийн карттай юу?</Text>
            </TouchableOpacity>

            {hasCard ? (
              <>
                <Text style={styles.label}>Хөнгөлсөн 1 литрийн үнэ (₮)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={cardPrice}
                  onChangeText={(t) => setCardPrice(t.replace(/[^0-9]/g, ''))}
                  placeholder={price ? String(Math.round(price * 0.97)) : '2950'}
                  placeholderTextColor={colors.textMuted}
                />
                {cardPriceNum && price && cardPriceNum > price ? (
                  <Text style={styles.cardWarn}>
                    Нийтийн үнэ {formatMNT(price)}-с их байна. Нийт дүнг биш,
                    1 ЛИТРИЙН үнийг бичнэ үү.
                  </Text>
                ) : saved > 0 ? (
                  <Text style={styles.cardSaved}>
                    Хэмнэлт ≈ {formatMNT(saved)}
                  </Text>
                ) : null}
              </>
            ) : null}

            {/* Литр — оруулсан дүнгээс автоматаар */}
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Авах түлш</Text>
              <Text style={styles.resultValue}>
                {liters ? `${liters.toFixed(2)} л` : '— л'}
              </Text>
              {vehicle.tank_capacity_liters ? (
                <Text style={styles.resultHint}>
                  Савны багтаамж {vehicle.tank_capacity_liters} л
                  {liters
                    ? ` · +${Math.min(
                        100,
                        (liters / vehicle.tank_capacity_liters) * 100
                      ).toFixed(0)}%`
                    : ''}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, (saving || !amountNum || !price) && styles.submitOff]}
            onPress={submit}
            disabled={saving || !amountNum || !price}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Цэнэглэх</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  priceBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
  },
  priceLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  priceValue: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: 6,
  },
  cardLabel: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  cardWarn: { color: colors.danger, fontSize: 12.5, marginTop: 6 },
  cardSaved: { color: colors.success, fontSize: 12.5, marginTop: 6, fontWeight: '700' },

  priceMissing: {
    color: colors.warning || '#d9863e',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 19,
  },

  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainer,
  },
  quickText: { color: colors.text, fontSize: 12.5, fontWeight: '600' },

  resultBox: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '14',
  },
  resultLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  resultValue: { color: colors.primary, fontSize: 30, fontWeight: '900', marginTop: 3 },
  resultHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  submit: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitOff: { opacity: 0.5 },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
});
