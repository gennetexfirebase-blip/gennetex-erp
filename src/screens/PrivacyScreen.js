import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Linking } from 'react-native';
import { Card, ScreenHeader, Button } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import { supabase } from '../lib/supabase';

/**
 * Нууцлал ба бүртгэл устгах.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   • Apple 5.1.1(v) — аппаас бүртгэл устгах зам байх ёстой
 *   • Google Play — Data deletion зам шаардана
 *   • Apple 5.1.5 / Play prominent disclosure — юу цуглуулж, хэн харахыг
 *     хэрэглэгчид ойлгомжтой хэлэх ёстой
 *
 * Энэ дэлгэц нь ажилтанд "миний юуг хэн харж байна вэ" гэсэн асуултад
 * бүрэн хариулна — reviewer ч мөн үүнийг хайдаг.
 */

const COLLECTED = [
  {
    title: 'Байршил',
    body:
      'Ажлын цагийн туршид, апп хаалттай эсвэл дэлгэц түгжээтэй байхад ч таны байршил тогтмол цуглуулагдана. Үүнийг таны ажил олгогчийн админ real-time харна.',
    who: 'Админ, захирал',
  },
  {
    title: 'Царайны загвар',
    body:
      'Ирц бүртгэхэд ашиглах царайны тоон загвар (embedding). Энэ нь зураг биш, буцаан царай сэргээх боломжгүй тоон дараалал юм.',
    who: 'Зөвхөн систем — хүн харахгүй',
  },
  {
    title: 'Ирцийн зураг',
    body: 'Ирц бүртгэх үед авсан selfie болон тухайн үеийн байршил.',
    who: 'Админ, захирал',
  },
  {
    title: 'Хувийн мэдээлэл',
    body: 'Нэр, Gmail хаяг, утас, албан тушаал, хаяг — эдгээрийг админ таны өмнөөс бүртгэдэг.',
    who: 'Админ, захирал',
  },
  {
    title: 'Чат, дуудлага',
    body:
      'Ажилтан хоорондын мессеж, дуут/видео дуудлагын түүх (үргэлжлэх хугацаа). Дуудлагын агуулга бичигдэхгүй.',
    who: 'Зөвхөн ярилцсан хүмүүс',
  },
  {
    title: 'Ажлын үйл ажиллагаа',
    body: 'Агуулахын бараа авсан бүртгэл, багаж, аялал, тайлан, апп доторх үйлдлийн лог.',
    who: 'Админ, захирал',
  },
  {
    title: 'Төхөөрөмжийн мэдээлэл',
    body: 'Мэдэгдэл хүргэх token, төхөөрөмжийн загвар, аппын хувилбар.',
    who: 'Зөвхөн систем',
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, signOut } = useApp();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Бүртгэл устгах',
      'Та итгэлтэй байна уу?\n\n' +
        '• Нэвтрэх эрх тань ШУУД хаагдана\n' +
        '• Царайны загвар, байршлын түүх, төхөөрөмжийн мэдээлэл устана\n' +
        '• Ирц, цалингийн бүртгэл нь хөдөлмөрийн хуулийн дагуу хадгалагдана\n\n' +
        'Энэ үйлдлийг буцаах боломжгүй.',
      [
        { text: 'Болих', style: 'cancel' },
        { text: 'Устгах', style: 'destructive', onPress: submitDelete },
      ]
    );
  };

  const submitDelete = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('request_account_deletion', {
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      Alert.alert(
        'Хүсэлт хүлээн авлаа',
        'Таны нэвтрэх эрх хаагдлаа. Үлдсэн өгөгдөл 30 хоногийн дотор устгагдана.\n\n' +
          'Асуух зүйл байвал байгууллагынхаа админд хандана уу.',
        [{ text: 'Ойлголоо', onPress: () => signOut?.() }]
      );
    } catch (e) {
      const m = String(e.message || '');
      Alert.alert(
        'Устгах',
        /last_superadmin/.test(m)
          ? 'Та системийн цорын ганц дээд админ тул устгах боломжгүй. Эхлээд өөр админ томилно уу.'
          : m || 'Алдаа гарлаа.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Нууцлал ба өгөгдөл" subtitle={currentUser?.email || ''} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
        <Card style={styles.card}>
          <Text style={styles.h1}>Энэ апп юу цуглуулдаг вэ</Text>
          <Text style={styles.p}>
            Gennetex ERP бол ажил олгогчийн систем. Доорх мэдээллийг ажлын зорилгоор
            цуглуулж, зөвхөн доор заасан хүмүүс харна.
          </Text>
        </Card>

        {COLLECTED.map((c) => (
          <Card key={c.title} style={styles.card}>
            <Text style={styles.h2}>{c.title}</Text>
            <Text style={styles.p}>{c.body}</Text>
            <Text style={styles.who}>Хэн харах: {c.who}</Text>
          </Card>
        ))}

        <Card style={styles.card}>
          <Text style={styles.h2}>Гуравдагч тал</Text>
          <Text style={styles.p}>
            Групп видео хурал нь гуравдагч талын нээлттэй сервер (Jitsi) дээр явагддаг.
            Хоёр хүний дуудлага нь шууд төхөөрөмж хооронд холбогдоно.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Таны эрх</Text>
          <Text style={styles.p}>
            • Байршлын зөвшөөрлийг утасныхаа тохиргооноос хэдийд ч цуцалж болно{'\n'}
            • Царайны бүртгэлээ дахин хийх, устгуулах хүсэлт гаргах{'\n'}
            • Бүртгэлээ бүхэлд нь устгах (доор)
          </Text>
        </Card>

        <Card style={[styles.card, styles.danger]}>
          <Text style={[styles.h2, { color: colors.danger }]}>Бүртгэл устгах</Text>
          <Text style={styles.p}>
            Нэвтрэх эрх тань шууд хаагдана. Царайны загвар, байршлын түүх, төхөөрөмжийн
            мэдээлэл 30 хоногийн дотор устгагдана. Ирц, цалингийн бүртгэл нь хөдөлмөрийн
            хуулийн дагуу хадгалагдана.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Шалтгаан (заавал биш)"
            placeholderTextColor={colors.textFaint}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Button
            title={busy ? 'Илгээж байна...' : 'Бүртгэл устгах'}
            variant="danger"
            disabled={busy}
            onPress={confirmDelete}
          />
        </Card>

        <Text style={styles.footer}>
          Асуулт байвал байгууллагынхаа админд хандана уу.
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { marginBottom: spacing.md },
    danger: { borderWidth: 1, borderColor: colors.danger },
    h1: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
    h2: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
    p: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
    who: { color: colors.primary, fontSize: 12.5, fontWeight: '700', marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      backgroundColor: colors.bgAlt,
      marginVertical: spacing.md,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    footer: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
  });
