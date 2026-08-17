/**
 * Ажилтны мэдээлэл — зурагт сүлжээ (grid).
 *
 * ХЭЛБЭР: хайлтын мөр → 2 баганат зургийн карт → нэр, албан тушаал
 * зургийн доод талд наасан цагаан хавтан дээр.
 *
 * ЯАГААД: өмнөх жагсаалт нь карт бүрд утас, имэйл, хаяг, 3 товч
 * багтаадаг байсан тул нэг дэлгэцэнд 2-3 хүн л харагдаж, "хэн байдаг
 * билээ" гэдгийг олоход удаан байв. Хүнийг НҮҮРЭЭР нь таних нь нэрээр
 * хайхаас хурдан — тиймээс зураг тэргүүн эгнээнд гарав.
 *
 * Холбоо барих мэдээлэл, дуудлагын товчнууд алга болоогүй — карт дээр
 * дарахад нээгдэх дэлгэрэнгүй цонхонд бүтнээрээ байна.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';
import { isOnline, formatLastSeen } from '../lib/online';
import { listPerfProps } from '../lib/performanceMode';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase() || '?';
}

/** Дуудлагад шаардлагатай талбарууд — бүтэн мөрийг дамжуулах шаардлагагүй. */
function peerOf(item, displayName) {
  return { id: item.id, name: displayName, avatar: item.avatar_url || null };
}

const fullName = (item) =>
  [item.last_name, item.name].filter(Boolean).join(' ') || item.name || '—';

export default function EmployeeDirectoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const { fetchDirectory, isCloud, currentUser } = useApp();
  const { placeCall } = useCall();

  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      setList(await fetchDirectory());
    } catch (e) {}
  }, [fetchDirectory]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Хоёр баганад тэнцүү хуваана. Дэлгэцийн өргөнөөс тооцсон тул
  // жижиг утас, таблет хоёр дээр адилхан зөв багтана.
  const gap = spacing.md;
  const cardWidth = (width - spacing.lg * 2 - gap) / 2;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((item) => {
      if (onlineOnly && !isOnline(item.last_seen)) return false;
      if (!q) return true;
      return [fullName(item), item.position, item.phone, item.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [list, query, onlineOnly]);

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилтны мэдээлэл" back />
        <EmptyState text="Supabase холболт шаардлагатай." />
      </View>
    );
  }

  const detailName = detail ? fullName(detail) : '';
  const detailOnline = detail ? isOnline(detail.last_seen) : false;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ажилтны мэдээлэл"
        subtitle={`${shown.length} ажилтан${onlineOnly ? ' · онлайн' : ''}`}
        back
      />

      {/* Хайлт + шүүлтүүр */}
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Нэр, албан тушаалаар хайх…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            accessibilityLabel="Ажилтан хайх"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, onlineOnly && styles.filterBtnOn]}
          onPress={() => setOnlineOnly((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Зөвхөн онлайн ажилтныг харуулах"
          accessibilityState={{ selected: onlineOnly }}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={onlineOnly ? colors.onPrimary : colors.text}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        numColumns={2}
        {...listPerfProps()}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap }}
        renderItem={({ item }) => {
          const online = isOnline(item.last_seen);
          const name = fullName(item);
          return (
            <TouchableOpacity
              style={[styles.card, { width: cardWidth }]}
              activeOpacity={0.9}
              onPress={() => setDetail(item)}
              accessibilityRole="button"
              accessibilityLabel={`${name}${item.position ? ', ' + item.position : ''}`}
              accessibilityHint="Дэлгэрэнгүй, дуудлага хийх"
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.photoInitials}>{initials(name)}</Text>
                </View>
              )}

              {online ? <View style={styles.onlineDot} /> : null}

              {/* Нэрийн хавтан — зургийн доод талд наалдсан */}
              <View style={styles.nameChip}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.role} numberOfLines={1}>
                    {item.position || 'Ажилтан'}
                  </Text>
                </View>
                <View style={styles.arrow}>
                  <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            text={query || onlineOnly ? 'Хайлтад тохирох ажилтан алга.' : 'Бүртгэлтэй ажилтан алга.'}
          />
        }
      />

      {/* --- Дэлгэрэнгүй --- */}
      <Modal visible={detail !== null} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailHead}>
                <View style={styles.detailAvatar}>
                  {detail?.avatar_url ? (
                    <Image source={{ uri: detail.avatar_url }} style={styles.detailAvatarImg} />
                  ) : (
                    <Text style={styles.photoInitials}>{initials(detailName)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName}>{detailName}</Text>
                  <Text style={styles.detailRole}>{detail?.position || 'Ажилтан'}</Text>
                  <Text style={[styles.detailStatus, detailOnline && styles.detailStatusOn]}>
                    {formatLastSeen(detail?.last_seen)}
                  </Text>
                </View>
              </View>

              {detail?.phone ? <InfoRow icon="call-outline" value={detail.phone} styles={styles} colors={colors} /> : null}
              {detail?.email ? <InfoRow icon="mail-outline" value={detail.email} styles={styles} colors={colors} /> : null}
              {detail?.address ? <InfoRow icon="location-outline" value={detail.address} styles={styles} colors={colors} /> : null}

              {/* Аппаар залгах нь оператороор дамжихгүй, үнэгүй. Утасны
                  дугаараар залгах сонголтыг ч үлдээв — тухайн ажилтан
                  апп нээгээгүй байж болно. */}
              <View style={styles.actions}>
                {detail && detail.id !== currentUser?.id ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => {
                        const peer = peerOf(detail, detailName);
                        setDetail(null);
                        placeCall(peer, 'audio');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${detailName} руу аппаар залгах`}
                    >
                      <Ionicons name="call" size={16} color={colors.onPrimary} />
                      <Text style={styles.actionPrimaryText}>Дуудлага</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => {
                        const peer = peerOf(detail, detailName);
                        setDetail(null);
                        placeCall(peer, 'video');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${detailName} руу видеогоор залгах`}
                    >
                      <Ionicons name="videocam" size={16} color={colors.onPrimary} />
                      <Text style={styles.actionPrimaryText}>Видео</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {detail?.phone ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${detail.phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${detail.phone} дугаар руу залгах`}
                  >
                    <Ionicons name="keypad" size={16} color={colors.primary} />
                    <Text style={styles.callText}>Утсаар</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, value, styles, colors }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.infoValue} selectable>{value}</Text>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // --- Хайлт ---
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  // --- Зургийн карт ---
  card: {
    aspectRatio: 0.82,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    ...shadow.sm,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  photoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  photoInitials: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nameChip: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  name: { color: colors.text, fontSize: 13, fontWeight: '800' },
  role: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Дэлгэрэнгүй ---
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  detailName: { color: colors.text, fontSize: 19, fontWeight: '800' },
  detailRole: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  detailStatus: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  detailStatusOn: { color: colors.success },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  infoValue: { color: colors.text, fontSize: 14, flex: 1 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  callText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
