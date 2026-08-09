import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import {
  Button,
  Field,
  ScreenHeader,
  HeaderButton,
  EmptyState,
  formatMNT,
} from '../components/ui';
import InventoryThumb from '../components/InventoryThumb';
import BarcodeScanner from '../components/BarcodeScanner';
import GiveToEmployeeModal from '../components/GiveToEmployeeModal';
import * as invApi from '../services/inventoryService';
import * as ohaabApi from '../services/ohaabService';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const EMPTY_FORM = {
  name: '',
  unit: 'ширхэг',
  quantity: '',
  price: '',
  barcode: '',
  category: 'material',
  image_url: null,
  imageUri: null,
};

const CAT_META = {
  material: { label: 'Бараа материал', empty: 'Бараа материал бүртгэгдээгүй байна.', lowLabel: 'бараа' },
  tool: { label: 'Багаж', empty: 'Багаж бүртгэгдээгүй байна.', lowLabel: 'багаж' },
};

const LOW_STOCK = 5;

async function pickImage(useCamera) {
  const perm = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Зөвшөөрөл', 'Камер эсвэл зургийн сан ашиглах зөвшөөрөл шаардлагатай.');
    return null;
  }
  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: true, aspect: [4, 3] })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsEditing: true, aspect: [4, 3] });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export default function InventoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const { colors, shadow } = useTheme();
  const styles = useStyles(makeStyles);
  const category = route.params?.category === 'tool' ? 'tool' : 'material';
  const meta = CAT_META[category];
  const cardWidth = (width - spacing.lg * 2 - spacing.sm) / 2;

  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    adjustQuantity,
    removeInventoryItem,
    withdrawItem,
    giveItemToEmployee,
    getItemByBarcode,
    isCloud,
    isAdmin,
    currentUser,
    refreshInventory,
    fetchEmployees,
  } = useApp();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanMode, setScanMode] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [takeItem, setTakeItem] = useState(null);
  const [takeQty, setTakeQty] = useState('1');
  const [takePhotoUri, setTakePhotoUri] = useState(null);
  const [takeSaving, setTakeSaving] = useState(false);
  const [giveItem, setGiveItem] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const requireOhaabForNewItem = async () => {
    if (!isCloud || !currentUser?.id) return true;
    const ok = await ohaabApi.ensureTodayAck(currentUser.id);
    if (!ok) ohaabApi.alertOhaabRequired(navigation);
    return ok;
  };

  const loadEmployees = useCallback(async () => {
    if (!isAdmin || !isCloud) return;
    try {
      const list = await fetchEmployees();
      setEmployees(list || []);
    } catch (e) {}
  }, [isAdmin, isCloud, fetchEmployees]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory
      .filter((it) => (it.category || 'material') === category)
      .filter((it) => {
        if (!q) return true;
        return (
          (it.name || '').toLowerCase().includes(q) ||
          (it.barcode || '').toLowerCase().includes(q)
        );
      });
  }, [inventory, category, search]);

  const lowStockCount = useMemo(
    () => filtered.filter((it) => it.quantity > 0 && it.quantity <= LOW_STOCK).length,
    [filtered]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshInventory();
    setRefreshing(false);
  };

  const totalValue = useMemo(
    () =>
      category === 'tool'
        ? filtered.reduce((sum, it) => sum + it.quantity * it.price, 0)
        : 0,
    [filtered, category]
  );

  const showPrice = category === 'tool';
  const screenTitle =
    !isAdmin && category === 'material'
      ? 'Бараа авах'
      : !isAdmin && category === 'tool'
        ? 'Багаж авах'
        : meta.label;

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category });
  };

  const closeFormModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Анхаар', 'Барааны нэр оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.image_url || null;
      if (form.imageUri && isCloud) {
        imageUrl = await invApi.uploadInventoryImage(form.imageUri);
      }
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim() || 'ширхэг',
        quantity: Number(form.quantity) || 0,
        price: showPrice ? Number(form.price) || 0 : 0,
        barcode: form.barcode.trim() || null,
        image_url: imageUrl,
        category,
      };
      if (editingId) {
        await updateInventoryItem(editingId, payload);
        Alert.alert('Хадгалагдлаа', `${payload.name} шинэчлэгдлээ.`);
      } else {
        await addInventoryItem(payload);
        Alert.alert('Нэмэгдлээ', `${payload.name} агуулахад бүртгэгдлээ.`);
      }
      closeFormModal();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const openAdd = async () => {
    const ok = await requireOhaabForNewItem();
    if (!ok) return;
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      unit: item.unit || 'ширхэг',
      quantity: String(item.quantity ?? ''),
      price: String(item.price ?? ''),
      barcode: item.barcode || '',
      category: item.category || category,
      image_url: item.image_url || null,
      imageUri: null,
    });
    setModalVisible(true);
  };

  const handleFormScan = (data) => {
    setScanMode(null);
    setForm((f) => ({ ...f, barcode: String(data || '').trim() }));
    setModalVisible(true);
  };

  const closeScanner = () => setScanMode(null);

  const handleTakeScan = async (data) => {
    setScanMode(null);
    let item = getItemByBarcode(data);
    if (!item && isCloud) {
      try {
        item = await invApi.fetchItemByBarcode(data);
        if (item) await refreshInventory();
      } catch (e) {}
    }
    if (!item) {
      Alert.alert('Олдсонгүй', `"${data}" кодтой бараа бүртгэлд алга.`);
      return;
    }
    const itemCat = item.category || 'material';
    if (itemCat !== category) {
      const where = itemCat === 'tool' ? 'Багаж' : 'Бараа материал';
      Alert.alert('Буруу ангилал', `Энэ код "${where}" хэсэгт бүртгэгдсэн.`);
      return;
    }
    openTake(item);
  };

  const handleScanned = (data) => {
    if (scanMode === 'form') handleFormScan(data);
    else if (scanMode === 'take') handleTakeScan(data);
  };

  const openScan = () => setScanMode('take');

  const openTake = (item) => {
    if (!isAdmin && item.quantity <= 0) {
      Alert.alert('Дууссан', 'Агуулахад үлдэгдэл байхгүй байна.');
      return;
    }
    setTakeItem(item);
    setTakeQty('1');
    setTakePhotoUri(null);
  };

  const confirmTake = async () => {
    const q = Number(takeQty) || 0;
    if (!takeItem || q <= 0) return;
    if (q > takeItem.quantity) {
      Alert.alert('Хүрэлцэхгүй', `Агуулахад ${takeItem.quantity} ${takeItem.unit} л байна.`);
      return;
    }
    if (!isAdmin && !takePhotoUri) {
      Alert.alert('Зураг шаардлагатай', 'Бараа авахын тулд баталгаа зураг авна уу.');
      return;
    }
    setTakeSaving(true);
    try {
      let photoUrl = null;
      if (takePhotoUri && isCloud) {
        photoUrl = await invApi.uploadMovementPhoto(takePhotoUri);
      }
      const item = takeItem;
      setTakeItem(null);
      setTakePhotoUri(null);
      await withdrawItem(item, q, photoUrl);
      Alert.alert(
        'Олгогдлоо',
        `${item.name}\n${q} ${item.unit} авлаа. Үлдэгдэл: ${item.quantity - q} ${item.unit}`
      );
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Авахад алдаа гарлаа');
    } finally {
      setTakeSaving(false);
    }
  };

  const handleGiveSubmit = async ({ employee, qty, photoUrl }) => {
    await giveItemToEmployee(giveItem, employee, qty, photoUrl);
    Alert.alert(
      'Олгогдлоо',
      `${giveItem.name}\n${qty} ${giveItem.unit} → ${employee.name}\nАгуулахын үлдэгдэл: ${giveItem.quantity - qty} ${giveItem.unit}`
    );
    setGiveItem(null);
  };

  const handleDelete = (item) => {
    Alert.alert('Устгах уу?', `${item.name} бүртгэлээс устгах уу?`, [
      { text: 'Болих', style: 'cancel' },
      { text: 'Устгах', style: 'destructive', onPress: () => removeInventoryItem(item.id) },
    ]);
  };

  const formImageUri = form.imageUri || form.image_url;

  const listHeader = (
    <View style={styles.listHeader}>
      {isAdmin && showPrice ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Нийт үнэлгээ</Text>
          <Text style={styles.summaryValue}>{formatMNT(totalValue)}</Text>
        </View>
      ) : null}

      {!isAdmin ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Бараа авах</Text>
          <Text style={styles.bannerText}>
            Жагсаалтаас сонгох эсвэл зураг авч баталгаажуулна. Бар код унших боломжтой.
          </Text>
          <View style={styles.bannerBtns}>
            <Button title="Бар код" variant="ghost" size="sm" onPress={openScan} />
          </View>
        </View>
      ) : null}

      {isAdmin && lowStockCount > 0 ? (
        <View style={styles.alertCard}>
          <Ionicons name="warning" size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Бага үлдэгдэл</Text>
            <Text style={styles.alertText}>{lowStockCount} {meta.lowLabel} дахин нөхөх шаардлагатай.</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`${meta.label} хайх...`}
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.countLabel}>{filtered.length} нэр төрөл</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const isLow = item.quantity > 0 && item.quantity <= LOW_STOCK;
    const isOut = item.quantity <= 0;
    const thumbUri = item.image_url;

    return (
      <TouchableOpacity
        style={[styles.gridCard, { width: cardWidth }, shadow.sm]}
        activeOpacity={isAdmin ? 0.9 : 0.85}
        onPress={() => {
          if (!isAdmin) openTake(item);
        }}
        onLongPress={isAdmin ? () => openEdit(item) : undefined}
      >
        <View style={styles.gridImageWrap}>
          <InventoryThumb
            name={item.name}
            category={item.category || category}
            imageUrl={thumbUri}
            size={cardWidth - spacing.md * 2}
          />
          <View style={[styles.stockBadge, isLow && styles.stockBadgeLow, isOut && styles.stockBadgeOut]}>
            <View style={[styles.stockDot, { backgroundColor: isOut ? colors.danger : isLow ? colors.warning : colors.success }]} />
            <Text style={[styles.stockBadgeText, isLow && { color: colors.warning }, isOut && { color: colors.danger }]}>
              {isOut ? 'Дууссан' : isLow ? 'Бага' : 'Байгаа'}
            </Text>
          </View>
        </View>

        <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
        {showPrice ? (
          <Text style={styles.gridSub}>{formatMNT(item.price)} / {item.unit}</Text>
        ) : (
          <Text style={styles.gridSub}>{item.unit}</Text>
        )}
        {item.barcode ? (
          <Text style={styles.gridBarcode} numberOfLines={1}>▮ {item.barcode}</Text>
        ) : null}

        <View style={styles.gridFooter}>
          <Text style={[styles.gridQty, isLow && { color: colors.warning }, isOut && { color: colors.danger }]}>
            {item.quantity}
          </Text>
          <Text style={styles.gridUnit}>{item.unit}</Text>
        </View>

        {isAdmin ? (
          <View style={styles.adminRow}>
            <TouchableOpacity style={styles.adminBtn} onPress={() => setGiveItem(item)}>
              <Ionicons name="person-add" size={14} color={colors.success} />
              <Text style={styles.adminBtnGive}>Олгох</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminBtn} onPress={() => openEdit(item)}>
              <Text style={styles.adminBtnEdit}>Засах</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminBtn} onPress={() => handleDelete(item)}>
              <Text style={styles.adminBtnDel}>Устгах</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepChip} onPress={() => adjustQuantity(item.id, -1)}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepChip} onPress={() => adjustQuantity(item.id, 1)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={screenTitle}
        subtitle={isCloud ? 'Онлайн' : 'Офлайн'}
        right={
          <View style={styles.headerBtns}>
            {!isAdmin ? (
              <>
                <HeaderButton
                  title="Үлдэгдэл"
                  onPress={() => navigation.navigate(category === 'tool' ? 'MyTools' : 'MyStock')}
                />
                <HeaderButton title="Унших" onPress={openScan} />
              </>
            ) : (
              <>
                <HeaderButton
                  title="Хэн авсан"
                  onPress={() => navigation.navigate('ToolAllocation', { category })}
                />
                <HeaderButton title="Нэмэх" onPress={openAdd} />
              </>
            )}
          </View>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          isCloud ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
        ListEmptyComponent={<EmptyState text={meta.empty} />}
      />

      {/* Нэмэх / засах */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingId ? `${meta.label} засах` : `${meta.label} нэмэх`}
              </Text>

              <Text style={styles.fieldLabel}>Зураг</Text>
              {formImageUri ? (
                <View style={styles.formPhotoWrap}>
                  <Image source={{ uri: formImageUri }} style={styles.formPhoto} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.formPhotoRemove}
                    onPress={() => setForm((f) => ({ ...f, imageUri: null, image_url: null }))}
                  >
                    <Ionicons name="close-circle" size={26} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formPhotoBtns}>
                  <TouchableOpacity
                    style={styles.formPhotoBtn}
                    onPress={async () => {
                      const uri = await pickImage(true);
                      if (uri) setForm((f) => ({ ...f, imageUri: uri, image_url: null }));
                    }}
                  >
                    <Ionicons name="camera" size={22} color={colors.primary} />
                    <Text style={styles.formPhotoBtnText}>Камераар</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.formPhotoBtn}
                    onPress={async () => {
                      const uri = await pickImage(false);
                      if (uri) setForm((f) => ({ ...f, imageUri: uri, image_url: null }));
                    }}
                  >
                    <Ionicons name="images" size={22} color={colors.primary} />
                    <Text style={styles.formPhotoBtnText}>Зургийн сан</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Field
                label="Барааны нэр *"
                placeholder="Ж: Цахилгаан кабель"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />
              <Field
                label="Хэмжих нэгж"
                placeholder="ширхэг / метр / кг"
                value={form.unit}
                onChangeText={(t) => setForm({ ...form, unit: t })}
              />
              <Field
                label="Тоо хэмжээ"
                placeholder="0"
                keyboardType="numeric"
                value={form.quantity}
                onChangeText={(t) => setForm({ ...form, quantity: t })}
              />
              {showPrice ? (
                <Field
                  label="Нэгж үнэ (₮)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(t) => setForm({ ...form, price: t })}
                />
              ) : null}
              <View style={styles.barcodeRow}>
                <Field
                  label="Бар код (заавал биш)"
                  placeholder="Скан эсвэл гараар"
                  value={form.barcode}
                  onChangeText={(t) => setForm({ ...form, barcode: t })}
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <Button title="Скан" variant="ghost" style={styles.scanBtn} onPress={() => setScanMode('form')} />
              </View>
              <View style={styles.modalActions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={closeFormModal} />
                <Button
                  title={editingId ? 'Хадгалах' : 'Нэмэх'}
                  style={{ flex: 1 }}
                  onPress={handleSave}
                  disabled={saving}
                />
              </View>
              {saving ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} /> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ажилтан авах */}
      <Modal visible={takeItem !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {category === 'tool' ? 'Багаж авах' : 'Бараа авах'}
              </Text>
              {takeItem ? (
                <>
                  <View style={styles.takePreview}>
                    <InventoryThumb
                      name={takeItem.name}
                      category={takeItem.category || category}
                      imageUrl={takeItem.image_url}
                      size={72}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.takeName}>{takeItem.name}</Text>
                      <Text style={styles.takeSub}>
                        Агуулахад: {takeItem.quantity} {takeItem.unit}
                      </Text>
                    </View>
                  </View>
                  <Field
                    label={`Авах тоо (${takeItem.unit})`}
                    placeholder="1"
                    keyboardType="numeric"
                    value={takeQty}
                    onChangeText={setTakeQty}
                  />
                  {!isAdmin ? (
                    <>
                      <Text style={styles.fieldLabel}>Баталгаа зураг *</Text>
                      {takePhotoUri ? (
                        <View style={styles.formPhotoWrap}>
                          <Image source={{ uri: takePhotoUri }} style={styles.formPhoto} resizeMode="cover" />
                          <TouchableOpacity
                            style={styles.formPhotoRemove}
                            onPress={() => setTakePhotoUri(null)}
                          >
                            <Ionicons name="close-circle" size={26} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.formPhotoBtns}>
                          <TouchableOpacity
                            style={styles.formPhotoBtn}
                            onPress={async () => {
                              const uri = await pickImage(true);
                              if (uri) setTakePhotoUri(uri);
                            }}
                          >
                            <Ionicons name="camera" size={22} color={colors.success} />
                            <Text style={[styles.formPhotoBtnText, { color: colors.success }]}>Зураг авах</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  ) : null}
                  <View style={styles.modalActions}>
                    <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setTakeItem(null)} />
                    <Button
                      title="Авах"
                      variant="success"
                      style={{ flex: 1 }}
                      onPress={confirmTake}
                      disabled={takeSaving}
                    />
                  </View>
                  {takeSaving ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.success} /> : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <GiveToEmployeeModal
        visible={giveItem !== null}
        item={giveItem}
        employees={employees}
        onClose={() => setGiveItem(null)}
        onSubmit={handleGiveSubmit}
      />

      <BarcodeScanner
        visible={scanMode !== null}
        onClose={closeScanner}
        onScanned={handleScanned}
        title={
          scanMode === 'take'
            ? category === 'tool'
              ? 'Багажийн бар код'
              : 'Барааны бар код'
            : 'Бар код унших'
        }
        hint="QR эсвэл EAN/Code128 зураасан код"
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' },
  listContent: { padding: spacing.lg, paddingBottom: 48 },
  listHeader: { marginBottom: spacing.md },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 2 },
  banner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  bannerTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs },
  bannerText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  bannerBtns: { flexDirection: 'row', gap: spacing.sm },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warning + '12',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertTitle: { color: colors.warning, fontWeight: '800', fontSize: 14 },
  alertText: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
  countLabel: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  gridImageWrap: { position: 'relative', marginBottom: spacing.sm, alignItems: 'center' },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface + 'ee',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockBadgeLow: { borderColor: colors.warning + '66' },
  stockBadgeOut: { borderColor: colors.danger + '66' },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success },
  gridName: { color: colors.text, fontSize: 14, fontWeight: '800', minHeight: 36 },
  gridSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  gridBarcode: { color: colors.primary, fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  gridFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.sm },
  gridQty: { color: colors.text, fontSize: 22, fontWeight: '900' },
  gridUnit: { color: colors.textMuted, fontSize: 11 },
  adminRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 6 },
  adminBtnGive: { color: colors.success, fontWeight: '700', fontSize: 12 },
  adminBtnEdit: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  adminBtnDel: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  stepper: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  stepChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  formPhotoWrap: { position: 'relative', marginBottom: spacing.md },
  formPhoto: { width: '100%', height: 160, borderRadius: radius.md },
  formPhotoRemove: { position: 'absolute', top: 8, right: 8 },
  formPhotoBtns: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  formPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgAlt,
  },
  formPhotoBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  barcodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md },
  scanBtn: { paddingVertical: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  takePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  takeName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  takeSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
