import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { ScreenHeader, Card, Button, EmptyState } from '../../components/ui';
import InventoryCategoryTabs from '../../components/InventoryCategoryTabs';
import * as aiApi from '../../services/aiInventoryService';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

const EMPTY = {
  name: '',
  sku: '',
  barcode: '',
  qr_code: '',
  category: 'material',
  brand: '',
  warehouse: '',
  shelf: '',
  stock: '0',
  min_stock: '0',
  purchase_price: '0',
  selling_price: '0',
  description: '',
};

export default function ProductTrainingScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, currentUser } = useApp();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await aiApi.fetchProducts({ category: categoryFilter }));
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    return products.filter((p) => (p.category || 'material') === categoryFilter);
  }, [products, categoryFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Бүтээгдэхүүн сургалт" />
        <EmptyState text="Зөвхөн админ бүтээгдэхүүн бүртгэнэ." />
      </View>
    );
  }

  const saveProduct = async () => {
    if (!form.name.trim()) {
      Alert.alert('Анхаар', 'Нэр оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      await aiApi.createProduct({
        ...form,
        stock: Number(form.stock) || 0,
        min_stock: Number(form.min_stock) || 0,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        created_by: currentUser?.id,
      });
      setFormOpen(false);
      setForm(EMPTY);
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  const addTrainingPhoto = async (product) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камерт хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled) return;
    try {
      let productId = product.id;
      if (product.inventoryId) {
        const ensured = await aiApi.ensureProductFromInventoryItem({
          id: product.inventoryId,
          name: product.name,
          barcode: product.barcode,
          category: product.category,
          quantity: product.stock,
          price: product.purchase_price,
        });
        productId = ensured.id;
      }
      await aiApi.addProductTrainingImage(productId, res.assets[0].uri);
      await load();
      Alert.alert('Нэмэгдлээ', 'Training зураг хадгалагдлаа.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const removeProduct = (product) => {
    Alert.alert('Устгах уу?', product.name, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await aiApi.deleteProduct(product.id);
            await load();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Бүтээгдэхүүн сургалт"
        subtitle={`${filteredProducts.length} бүтээгдэхүүн`}
        right={
          <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        }
      />

      <InventoryCategoryTabs value={categoryFilter} onChange={setCategoryFilter} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyState
              text={
                categoryFilter === 'tool'
                  ? 'Багаж алга. Багаж хэсэгт бүртгээд training зураг нэмнэ үү.'
                  : categoryFilter === 'material'
                    ? 'Бараа материал алга. Бараа материал хэсэгт бүртгэнэ үү.'
                    : 'Бүтээгдэхүүн алга. Бараа материал эсвэл багаж хэсэгт бүртгэнэ үү.'
              }
            />
          }
          renderItem={({ item }) => {
            const imgs = item.product_images || [];
            const catLabel = aiApi.getProductCategoryLabel(item.category);
            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {catLabel} · SKU: {item.sku || '—'} · Баркод: {item.barcode || '—'}
                    </Text>
                    <Text style={styles.meta}>
                      {item.warehouse || 'Агуулах'} / {item.shelf || 'Тавиур'} · Үлдэгдэл:{' '}
                      <Text style={styles.stock}>{item.stock}</Text>
                    </Text>
                    <Text style={styles.meta}>Training зураг: {imgs.length}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeProduct(item)}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
                  {imgs.map((img) => (
                    <Image key={img.id} source={{ uri: img.image_url }} style={styles.thumb} />
                  ))}
                  <TouchableOpacity style={styles.addThumb} onPress={() => addTrainingPhoto(item)}>
                    <Ionicons name="camera" size={22} color={colors.primary} />
                    <Text style={styles.addThumbText}>Зураг</Text>
                  </TouchableOpacity>
                </ScrollView>
                <Button
                  title="Training зураг нэмэх"
                  size="sm"
                  variant="ghost"
                  onPress={() => addTrainingPhoto(item)}
                />
              </Card>
            );
          }}
        />
      )}

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Шинэ бүтээгдэхүүн</Text>
            <ScrollView>
              {[
                ['name', 'Нэр *'],
                ['sku', 'SKU'],
                ['barcode', 'Баркод'],
                ['qr_code', 'QR'],
                ['brand', 'Брэнд'],
                ['warehouse', 'Агуулах'],
                ['shelf', 'Тавиур'],
                ['stock', 'Current Stock'],
                ['min_stock', 'Minimum Stock'],
                ['purchase_price', 'Purchase Price'],
                ['selling_price', 'Selling Price'],
                ['description', 'Description'],
              ].map(([key, label]) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={String(form[key] ?? '')}
                    onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
                    keyboardType={
                      key.includes('stock') || key.includes('price') ? 'numeric' : 'default'
                    }
                    multiline={key === 'description'}
                  />
                </View>
              ))}
              <View style={styles.field}>
                <Text style={styles.label}>Ангилал</Text>
                <View style={styles.catRow}>
                  {['material', 'tool'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catChip, form.category === c && styles.catChipOn]}
                      onPress={() => setForm((f) => ({ ...f, category: c }))}
                    >
                      <Text style={[styles.catText, form.category === c && styles.catTextOn]}>
                        {c === 'tool' ? 'Багаж' : 'Бараа'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setFormOpen(false)} />
              <Button title={saving ? '...' : 'Хадгалах'} style={{ flex: 1 }} onPress={saveProduct} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  stock: { color: colors.primary, fontWeight: '800' },
  imgRow: { marginTop: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 8, backgroundColor: colors.surfaceAlt },
  addThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumbText: { color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  catRow: { flexDirection: 'row', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
  },
  catChipOn: { backgroundColor: colors.primary },
  catText: { color: colors.textMuted, fontWeight: '700' },
  catTextOn: { color: '#fff' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
