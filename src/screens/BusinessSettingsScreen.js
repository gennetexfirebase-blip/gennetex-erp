import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card, Button, Field, ScreenHeader } from '../components/ui';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing } from '../theme';
import {
  DEFAULT_COMPANY_SETTINGS,
  fetchCompanySettings,
  lateFromLabel,
  normalizeCompanySettings,
  updateCompanySettings,
  workStartLabel,
} from '../services/companySettingsService';

const TOGGLES = [
  ['low_stock_alert_enabled', 'Бага үлдэгдэл', 'Бараа доод хэмжээнд хүрэхэд анхааруулна.'],
  ['training_alert_enabled', 'Сургалтын хугацаа', 'Заавал суух сургалтын хугацааг хянана.'],
  ['vehicle_alert_enabled', 'Машины хугацаа', 'Үзлэг болон даатгалын хугацааг хянана.'],
];

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [form, setForm] = useState(DEFAULT_COMPANY_SETTINGS);
  const [reminderText, setReminderText] = useState('30, 7, 1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCompanySettings()
      .then((value) => {
        if (!active) return;
        setForm(value);
        setReminderText(value.reminder_days.join(', '));
      })
      .catch((error) => Alert.alert('Тохиргоо', error?.message || 'Тохиргоо ачаалж чадсангүй.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const start = workStartLabel(form);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) {
      Alert.alert('Ирэх цаг', 'Цагийг 09:00 хэлбэрээр зөв оруулна уу.');
      return;
    }
    const days = reminderText
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 365);
    if (!days.length) {
      Alert.alert('Сануулах хоног', 'Жишээ нь 30, 7, 1 гэж оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateCompanySettings(normalizeCompanySettings({
        ...form,
        work_start_time: start,
        late_grace_minutes: Number(form.late_grace_minutes || 0),
        default_min_stock: Number(form.default_min_stock || 0),
        reminder_days: days,
      }));
      setForm(saved);
      setReminderText(saved.reminder_days.join(', '));
      Alert.alert('Амжилттай', 'Компанийн тохиргоо шинэчлэгдлээ.');
    } catch (error) {
      Alert.alert('Хадгалж чадсангүй', error?.message || 'Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Тохиргооны төв" subtitle="Компанийн бизнес дүрэм" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.sectionTitle}>Ирцийн дүрэм</Text>
          <Field
            label="Ажилд ирэх цаг"
            value={workStartLabel(form)}
            onChangeText={(value) => setValue('work_start_time', value)}
            placeholder="09:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
          <Field
            label="Хоцролтын зөвшөөрөх минут"
            value={String(form.late_grace_minutes)}
            onChangeText={(value) => setValue('late_grace_minutes', value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            hint={`Одоогийн дүрмээр ${lateFromLabel(form)}-ээс хоцорсонд тооцно.`}
          />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Агуулах ба сануулга</Text>
          <Field
            label="Барааны үндсэн доод үлдэгдэл"
            value={String(form.default_min_stock)}
            onChangeText={(value) => setValue('default_min_stock', value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            hint="Бараа тусдаа доод хэмжээтэй бол тэр утга давуу үйлчилнэ."
          />
          <Field
            label="Урьдчилан сануулах хоногууд"
            value={reminderText}
            onChangeText={setReminderText}
            placeholder="30, 7, 1"
            keyboardType="numbers-and-punctuation"
          />
          {TOGGLES.map(([key, title, subtitle], index) => (
            <View key={key} style={[styles.toggleRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>{title}</Text>
                <Text style={styles.toggleSub}>{subtitle}</Text>
              </View>
              <Switch
                value={!!form[key]}
                onValueChange={(value) => setValue(key, value)}
                trackColor={{ false: colors.surfaceAlt, true: colors.primary + '88' }}
                thumbColor={form[key] ? colors.primary : colors.textFaint}
              />
            </View>
          ))}
        </Card>

        <Button title="Тохиргоо хадгалах" onPress={save} loading={saving || loading} />
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 48 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.lg },
  toggleRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  toggleSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
