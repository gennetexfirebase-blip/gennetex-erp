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
import MultiScanSheet from '../components/MultiScanSheet';
import { splitScannedCodes, shortCode } from '../lib/scanCodes';
import GiveToEmployeeModal from '../components/GiveToEmployeeModal';
import * as invApi from '../services/inventoryService';
import * as boxApi from '../services/boxService';
import * as ohaabApi from '../services/ohaabService';
import * as deptApi from '../services/departmentService';
import { imageQuality, listPerfProps } from '../lib/performanceMode';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

import { SIZE_KINDS, sizeKind, detectSizeKind } from '../lib/supplySizes';

const EMPTY_FORM = {
  name: '',
  unit: 'ширхэг',
  // Хангамжийн размер. `sizeKind` = none | clothing | shoes.
  // `sizeQty` нь { XL: '15', XXL: '5' } хэлбэрээр размер бүрийн тоог хадгална.
  sizeKind: 'none',
  sizeQty: {},
  size_group: null,
  quantity: '',
  price: '',
  barcode: '',
  category: 'material',
  image_url: null,
  imageUri: null,
  min_stock: '',
  sku: '',
  location: '',
  supplier: '',
  serial_no: '',
  note: '',
  // `null` = НИЙТИЙН (бүх хэлтэс харна). Хэлтэс сонгосон бол зөвхөн
  // тэр хэлтсийнхэн харна — шүүлт нь өгөгдлийн сангийн RLS дээр.
  department_id: null,
  boxCode: '',      // аль хайрцагт хийх вэ
  boxQty: '',       // тэр хайрцагт хэдэн ширхэг байгаа
};

/** Тоон талбарыг шалгана. Хоосон бол 0, сөрөг/буруу бол null. */
function parseQty(v) {
  const t = String(v ?? '').trim();
  if (!t) return 0;
  const n = Number(t.replace(/,/g, '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Хэмжих нэгжүүд.
 *
 * Метр, кг зэрэг нь бүхэл биш байж болно (12.5 м). Гэвч ТООЛОХ нь
 * ширхэгтэй адил — 12.5 метрээс 3 метр авбал 9.5 үлдэнэ. Тиймээс
 * тусдаа логик хэрэггүй, зөвхөн бутархай зөвшөөрөх эсэхийг заана.
 */
const UNITS = [
  { key: 'ширхэг', label: 'Ширхэг', decimal: false, hint: 'Бүхэл тоогоор тоолно' },
  { key: 'метр', label: 'Метр', decimal: true, hint: 'Бутархай байж болно — ж: 12.5 м' },
  { key: 'кг', label: 'Кг', decimal: true, hint: 'Бутархай байж болно — ж: 2.4 кг' },
  { key: 'литр', label: 'Литр', decimal: true, hint: 'Бутархай байж болно' },
  { key: 'багц', label: 'Багц', decimal: false, hint: 'Бүхэл тоогоор тоолно' },
  { key: 'хайрцаг', label: 'Хайрцаг', decimal: false, hint: 'Бүхэл тоогоор тоолно' },
  { key: 'ороомог', label: 'Ороомог', decimal: false, hint: 'Бүхэл тоогоор тоолно' },
];

const CAT_META = {
  material: { label: 'Бараа материал', empty: 'Бараа материал бүртгэгдээгүй байна.', lowLabel: 'бараа' },
  tool: { label: 'Багаж', empty: 'Багаж бүртгэгдээгүй байна.', lowLabel: 'багаж' },
  supply: { label: 'Хангамж', empty: 'Хангамж бүртгэгдээгүй байна.', lowLabel: 'хангамж' },
};

/** Хүчинтэй төрлүүд — route-оор ирсэн утгыг шалгахад ашиглана. */
const CATEGORIES = Object.keys(CAT_META);

const LOW_STOCK = 5;

/** Дэлгэрэнгүй цонхны нэг мөр — "нэр : утга". */
function DetailRow({ label, value }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

async function pickImage(useCamera) {
  const perm = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Зөвшөөрөл', 'Камер эсвэл зургийн сан ашиглах зөвшөөрөл шаардлагатай.');
    return null;
  }
  // Сул утсанд өндөр нягтралтай зураг санах ойд багтахгүй, илгээлт удаан.
  const quality = imageQuality();
  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ quality, allowsEditing: true, aspect: [4, 3] })
    : await ImagePicker.launchImageLibraryAsync({ quality, allowsEditing: true, aspect: [4, 3] });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export default function InventoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, shadow } = useTheme();
  const styles = useStyles(makeStyles);
  // Route-оор ирсэн төрлийг шалгана. Танихгүй утга ирвэл бараа материал.
  const routeCategory = route.params?.category;
  const category = CATEGORIES.includes(routeCategory) ? routeCategory : 'material';
  const meta = CAT_META[category];

  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    adjustQuantity,
    removeInventoryItem,
    giveItemToEmployee,
    getItemByBarcode,
    isCloud,
    isManager,
    departmentId: myDepartmentId,
    currentUser,
    refreshInventory,
    fetchEmployees,
  } = useApp();

  /**
   * Агуулах удирдах эрхтэй эсэх.
   *
   * Урьд нь `isAdmin` байсныг АХЛАХ багтаах болгов: ахлах өөрийн
   * хэлтсийн бараа, багажийг бүртгэж, ажилтандаа олгоно. Аль хэлтсийн
   * зүйл харагдахыг серверийн RLS шийднэ — энэ хувьсагч нь зөвхөн
   * товч, талбар харуулах эсэхийг заана.
   */
  const isAdmin = isManager;
  const [departments, setDepartments] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanMode, setScanMode] = useState(null);
  const [bulkCodes, setBulkCodes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // Нэр дээр дарахад нээгдэх дэлгэрэнгүй — зураг, тоо ширхэг энд харагдана
  const [detailItem, setDetailItem] = useState(null);
  const [giveItem, setGiveItem] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [newBox, setNewBox] = useState({ code: '', name: '' });
  const [boxView, setBoxView] = useState(null); // QR уншаад харуулж буй хайрцаг
  const [wholeBoxCode, setWholeBoxCode] = useState(null); // бүтнээр олгох хайрцаг
  const [issueSession, setIssueSession] = useState(null); // ширхэгээр олгож буй сесс

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

  // Хайрцгийн жагсаалт — бараа нэмэхэд сонгоно. Зөвхөн админд хэрэгтэй.
  const loadBoxes = useCallback(async () => {
    if (!isAdmin || !isCloud) return;
    try {
      setBoxes(await boxApi.fetchBoxes());
    } catch (e) {
      // Хайрцаг байхгүй ч бараа бүртгэх боломжтой байх ёстой
    }
  }, [isAdmin, isCloud]);

  useEffect(() => {
    loadBoxes();
  }, [loadBoxes]);

  // Хэлтсийн жагсаалт — бараа/багажийг хэлтэст хуваарилахад сонгоно.
  useEffect(() => {
    if (!isAdmin || !isCloud) return;
    let alive = true;
    deptApi
      .fetchDepartments()
      .then((rows) => alive && setDepartments(rows))
      .catch(() => {}); // хэлтэсгүй ч агуулах ажиллана
    return () => {
      alive = false;
    };
  }, [isAdmin, isCloud]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory
      .filter((it) => (it.category || 'material') === category)
      .filter((it) => {
        if (!q) return true;
        return (
          (it.name || '').toLowerCase().includes(q) ||
          (it.barcode || '').toLowerCase().includes(q) ||
          (it.sku || '').toLowerCase().includes(q) ||
          (it.location || '').toLowerCase().includes(q) ||
          (it.supplier || '').toLowerCase().includes(q)
        );
      });
  }, [inventory, category, search]);

  // Бараа тус бүрийн min_stock-ийг ашиглана. Тохируулаагүй бол LOW_STOCK-д
  // шилжинэ — ингэснээр хуучин бүртгэлүүд ч сануулга өгсөн хэвээр байна.
  const isLow = useCallback(
    (it) => {
      const threshold = Number(it.min_stock) > 0 ? Number(it.min_stock) : LOW_STOCK;
      return it.quantity > 0 && it.quantity <= threshold;
    },
    []
  );

  const lowStockCount = useMemo(() => filtered.filter(isLow).length, [filtered, isLow]);

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
  /**
   * Хангамж дээр ЗӨВХӨН хувцас, гутал бүртгэнэ.
   *
   * Тиймээс нэгж (үргэлж ширхэг), MAC/SN, SKU, байршил, нийлүүлэгч,
   * хайрцаг зэрэг талбар хэрэггүй — маягтыг цэвэр байлгана. Илүү талбар
   * харагдвал бөглөх ёстой юм шиг санагдаж, ажил удаашруулна.
   */
  const isSupply = category === 'supply';
  // Ажилтан өөрөө авахгүй тул "Бараа авах" гэсэн гарчиг байхаа больсон —
  // харагдах бол зөвхөн агуулахын үлдэгдлийг ХАРАХ жагсаалт.
  const screenTitle = meta.label;

  /** Хайрцгийн жагсаалтаас гарахгүйгээр шинэ хайрцаг үүсгэнэ. */
  const createBox = async () => {
    const code = newBox.code.trim();
    const name = newBox.name.trim();
    if (!code || !name) {
      Alert.alert('Хайрцаг', 'Код болон нэрийг бөглөнө үү.');
      return;
    }
    try {
      await boxApi.upsertBox({ code, name });
      await loadBoxes();
      setForm((f) => ({ ...f, boxCode: code }));
      setNewBox({ code: '', name: '' });
      setBoxPickerOpen(false);
      setTimeout(() => setModalVisible(true), 220);
    } catch (e) {
      Alert.alert('Хайрцаг', e.message);
    }
  };

  /** Бүтэн хайрцгийг ажилтанд олгохыг баталгаажуулна. */
  const confirmWholeBox = (emp) => {
    const bc = wholeBoxCode;
    Alert.alert(
      'Хайрцгаар олгох',
      `"${bc}" хайрцгийг бүтнээр ${emp.name || 'ажилтан'}-д олгох уу?

` +
        'Доторх бүх зүйл тухайн хүний нэр дээр шилжиж, агуулахаас хасагдана.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Олгох',
          onPress: async () => {
            try {
              const res = await boxApi.issueWholeBox({ boxCode: bc, userId: emp.id });
              setWholeBoxCode(null);
              await refreshInventory?.();
              await loadBoxes();
              Alert.alert(
                'Олгогдлоо',
                `${res.employee}

${res.items} нэр төрөл, ${res.serials} серийн дугаар шилжлээ.

Хайрцаг хоосорсон — дахин ашиглаж болно.`
              );
            } catch (e) {
              Alert.alert('Олгох', e.message);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setEditingId(null);
    // Хэлтэстэй удирдагчийн бүртгэсэн зүйл автоматаар түүний хэлтэст
    // орно — эс тэгвээс бүртгээд л өөрөө нь харахаа болино (RLS).
    setForm({
      ...EMPTY_FORM,
      category,
      department_id: myDepartmentId,
      // Хангамж = хувцас, гутал. Размергүй хувилбар байхгүй тул шууд
      // хувцас дээр тохируулна — нэг товшилт хэмнэнэ.
      sizeKind: category === 'supply' ? 'clothing' : 'none',
    });
  };

  const closeFormModal = () => {
    setModalVisible(false);
    resetForm();
  };

  /**
   * Нэг QR доторх БҮХ MAC/SN-ийг тусдаа бүртгэл болгож хадгална.
   *
   * Сүлжээний төхөөрөмж бүр өөрийн MAC-тай тул нэг мөрөнд "тоо 10" гэж
   * бичих нь буруу — дараа нь аль төхөөрөмж хэнд олгогдсоныг мөрдөх
   * боломжгүй болно. Тиймээс ширхэг бүрийг тусад нь, тоо = 1 гэж үүсгэнэ.
   */
  /**
   * Хайрцгийн QR доторх БҮХ MAC/SN-ийг бөөнөөр бүртгэнэ.
   *
   * НЭГ барааны бүртгэл үүсч, серийн дугаарууд нь хайрцагтаа хадгалагдана.
   * Өмнө нь MAC тутамд ТУСДАА бараа үүсгэдэг байсан тул жагсаалт ижил
   * нэртэй хэдэн арван картаар дүүрч ашиглах боломжгүй болдог байв.
   */
  const saveBulk = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Анхаар', 'Барааны нэр оруулна уу.');
      return;
    }
    if (!form.boxCode) {
      Alert.alert(
        'Хайрцаг сонгоно уу',
        `Уншсан ${bulkCodes.length} MAC/SN нь аль хайрцагт байгааг заах шаардлагатай.

` +
          'Дээрх "Хайрцаг" хэсгээс сонгоно уу — байхгүй бол тэндээс шинээр үүсгэж болно.'
      );
      return;
    }

    setSaving(true);
    try {
      const res = await boxApi.registerSerials({
        boxCode: form.boxCode,
        name,
        serials: bulkCodes,
        category,
        unit: form.unit || 'ширхэг',
        price: showPrice ? parseQty(form.price) || 0 : 0,
      });
      await refreshInventory?.();
      await loadBoxes();
      setBulkCodes([]);
      setModalVisible(false);
      resetForm();

      const boxName = boxes.find((b) => b.code === form.boxCode)?.name || form.boxCode;
      const lines = [`${res.itemName} — ${res.added} ширхэг "${boxName}" хайрцагт нэмэгдлээ.`];
      if (res.skipped) lines.push(`${res.skipped} MAC/SN өмнө нь бүртгэгдсэн тул алгасав.`);
      lines.push(`Тухайн хайрцагт нийт: ${res.totalInBox} ширхэг`);
      Alert.alert('Бүртгэгдлээ', lines.join('\n\n'));
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Анхаар', 'Барааны нэр оруулна уу.');
      return;
    }
    // Хангамж дээр тоо хэмжээг размер бүрээр нь оруулдаг тул нэгдсэн
    // "Тоо хэмжээ" талбар байхгүй — шалгалтыг доор, размерын хэсэгт хийнэ.
    const usesSizes = isSupply && form.sizeKind !== 'none';
    const qty = usesSizes ? 0 : parseQty(form.quantity);
    if (qty === null) {
      Alert.alert('Анхаар', 'Тоо хэмжээ нь 0 буюу түүнээс их тоо байх ёстой.');
      return;
    }
    const minStock = parseQty(form.min_stock);
    if (minStock === null) {
      Alert.alert('Анхаар', 'Бага үлдэгдлийн босго нь 0 буюу түүнээс их тоо байх ёстой.');
      return;
    }
    const unitPrice = showPrice ? parseQty(form.price) : 0;
    if (unitPrice === null) {
      Alert.alert('Анхаар', 'Үнэ нь 0 буюу түүнээс их тоо байх ёстой.');
      return;
    }

    // Баркод/SKU давхардвал буруу бараа хасагдах эрсдэлтэй тул урьдчилан шалгана
    const barcode = form.barcode.trim();
    const sku = form.sku.trim().toUpperCase();
    const clash = inventory.find(
      (it) =>
        it.id !== editingId &&
        ((barcode && (it.barcode || '').trim() === barcode) ||
          (sku && (it.sku || '').trim().toUpperCase() === sku))
    );
    if (clash) {
      const which =
        barcode && (clash.barcode || '').trim() === barcode ? 'бар код' : 'SKU';
      Alert.alert(
        'Давхардал',
        `Энэ ${which} аль хэдийн "${clash.name}" дээр бүртгэгдсэн байна.`
      );
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
        quantity: qty,
        price: unitPrice,
        barcode: barcode || null,
        image_url: imageUrl,
        category,
        min_stock: minStock,
        sku: sku || null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        serial_no: category === 'tool' ? form.serial_no.trim() || null : null,
        note: form.note.trim() || null,
        department_id: form.department_id || null,
      };
      /**
       * ХАНГАМЖ — размер бүрийг ТУСДАА мөр болгож бүртгэнэ.
       *
       * "Ажлын хантааз XL 15ш" ба "Ажлын хантааз XXL 5ш" нь хоёр өөр
       * мөр болно. Тус бүр өөрийн үлдэгдэлтэй тул ажилтанд XL олгоход
       * зөвхөн XL хасагдана.
       *
       * `size_group` нь тэдгээрийг холбож, жагсаалтад нэг бараа мэт
       * бүлэглэн харуулах боломж өгнө.
       */
      if (isSupply && form.sizeKind !== 'none') {
        const entries = Object.entries(form.sizeQty || {})
          .map(([sz, v]) => [sz, Number(v)])
          .filter(([, n]) => Number.isFinite(n) && n > 0);

        if (!entries.length) {
          Alert.alert('Размер дутуу', 'Дор хаяж нэг размерын тоог оруулна уу.');
          setSaving(false);
          return;
        }

        // Засварлаж байгаа бол хуучин бүлгээ хадгална — эс тэгвээс
        // засах бүрд шинэ бүлэг үүсч, хуучин размерууд тасарна.
        const groupId = form.size_group || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        for (const [sz, n] of entries) {
          await addInventoryItem({
            ...payload,
            unit: 'ширхэг',
            quantity: n,
            size: sz,
            size_group: groupId,
            barcode: null,
          });
        }
        Alert.alert(
          'Нэмэгдлээ',
          `${payload.name} — ${entries.length} размер бүртгэгдлээ.`
        );
      } else if (editingId) {
        await updateInventoryItem(editingId, payload);
        Alert.alert('Хадгалагдлаа', `${payload.name} шинэчлэгдлээ.`);
      } else {
        await addInventoryItem(payload);
        Alert.alert('Нэмэгдлээ', `${payload.name} агуулахад бүртгэгдлээ.`);
      }

      // Хайрцаг сонгосон бол тэр хайрцагт хийнэ. Агуулахын бүртгэл
      // амжилттай болсны ДАРАА хийж байгаа шалтгаан: хайрцгийн RPC нь
      // барааг кодоор нь хайдаг тул бараа эхлээд бүртгэгдсэн байх ёстой.
      const boxQty = Number(form.boxQty);
      if (form.boxCode && boxQty > 0) {
        const codeForBox = barcode || (category === 'tool' ? form.serial_no.trim() : '');
        if (!codeForBox) {
          Alert.alert(
            'Хайрцагт хийгдсэнгүй',
            'Хайрцагт хийхийн тулд MAC/SN шаардлагатай. Бараа агуулахад бүртгэгдсэн — MAC/SN нэмээд хайрцгийн хэсгээс дахин оруулна уу.'
          );
        } else {
          try {
            const res = await boxApi.putItem({
              boxCode: form.boxCode,
              barcode: codeForBox,
              quantity: boxQty,
            });
            Alert.alert(
              'Хайрцагт хийгдлээ',
              `${res.itemName} — тухайн хайрцагт нийт ${res.quantity} ширхэг боллоо.`
            );
          } catch (e) {
            Alert.alert('Хайрцагт хийхэд алдаа', e.message);
          }
        }
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
      min_stock: item.min_stock != null ? String(item.min_stock) : '',
      sku: item.sku || '',
      location: item.location || '',
      supplier: item.supplier || '',
      serial_no: item.serial_no || '',
      note: item.note || '',
      department_id: item.department_id || null,
    });
    setModalVisible(true);
  };

  const handleFormScan = (data) => {
    setScanMode(null);

    // Хайрцаг дээрх QR нь ихэвчлэн доторх БҮХ төхөөрөмжийн MAC/SN-ийг
    // мөр мөрөөр агуулдаг. Өмнө нь бүх мөрийг НЭГ талбарт хийдэг байсан
    // тул олон мөрт утга нэг барааны код болж бүртгэгдэж, хайлт хэзээ ч
    // тохирдоггүй байв.
    const codes = splitScannedCodes(data);

    if (codes.length <= 1) {
      setForm((f) => ({ ...f, barcode: codes[0] || '' }));
      setModalVisible(true);
      return;
    }

    // Олон код — эхнийхийг талбарт тавьж, үлдсэнийг нь бөөнөөр
    // бүртгэх эсэхийг асууна.
    setForm((f) => ({ ...f, barcode: codes[0] }));
    setBulkCodes(codes);
    setModalVisible(true);
  };

  const closeScanner = () => {
    const wasForm = scanMode === 'form';
    setScanMode(null);
    // Формоос сканнер нээсэн бол буцахад форм алга болох ёсгүй.
    if (wasForm) setTimeout(() => setModalVisible(true), 250);
  };

  const handleTakeScan = async (data) => {
    // Хайрцгийн QR уу? Хайрцаг бол доторх БҮХ бүртгэлийг харуулна.
    // Өмнө нь хайрцгийн QR-ыг барааны код гэж үзээд "олдсонгүй" гэдэг
    // байсан тул хайрцагт юу байгааг харах ямар ч зам байгаагүй.
    const maybeBoxCode = boxApi.parseQr(data);
    if (maybeBoxCode) {
      try {
        const res = await boxApi.fetchBoxByCode(maybeBoxCode);
        if (res.box || res.empty) {
          setScanMode(null);
          setBoxView({ code: maybeBoxCode, box: res.box, items: res.items });
          return;
        }
      } catch (e) {
        // Хайрцаг биш байна — доор барааны код гэж үзэж үргэлжилнэ
      }
    }

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
      const where = CAT_META[itemCat]?.label || 'Бараа материал';
      Alert.alert('Буруу ангилал', `Энэ код "${where}" хэсэгт бүртгэгдсэн.`);
      return;
    }
    // Код уншсаны дараа: админ бол шууд "хэнд олгох" руу, ажилтан бол
    // зөвхөн үлдэгдлийн мэдээлэл. Ажилтан өөрөө авах зам байхгүй.
    if (isAdmin) {
      setGiveItem(item);
    } else {
      Alert.alert(
        item.name,
        `Агуулахад: ${item.quantity} ${item.unit}\n\nБараа материал болон багажийг зөвхөн админ олгоно. Шаардлагатай бол админд хандана уу.`
      );
    }
  };

  const handleScanned = (data) => {
    if (scanMode === 'form') handleFormScan(data);
    else if (scanMode === 'take') handleTakeScan(data);
  };

  const openScan = () => setScanMode('take');

  /**
   * Ажилтанд олгох.
   *
   * ХОЁР ГОРИМ:
   *   whole  — тоо хэмжээгээр шууд хасаад дуусна (хайрцгаар)
   *   pieces — код уншуулах хэсэг НЭН ДАРУЙ нээгдэж, уншуулсан бараа
   *            тус бүр агуулахаас хасагдана
   *
   * Ширхэгээр горимд шууд хасахгүй байгаа шалтгаан: аль ЯГ ТЭР
   * төхөөрөмж (MAC/SN) очсоныг мэдэх ёстой. Зөвхөн тоо хасвал дараа нь
   * "энэ MAC хэнд байна вэ" гэдэгт хариулах боломжгүй.
   */
  const handleGiveSubmit = async ({ employee, qty, photoUrl, mode }) => {
    if (mode === 'pieces') {
      // Модалыг хааж, код уншуулах хэсгийг нээнэ. Modal дээр Modal
      // давхарлавал камер харагдахгүй тул дараалуулна.
      const target = { employee, qty: Number(qty) || 1, item: giveItem };
      setGiveItem(null);
      setTimeout(() => setIssueSession(target), 260);
      return;
    }

    await giveItemToEmployee(giveItem, employee, qty, photoUrl);
    Alert.alert(
      'Олгогдлоо',
      `${giveItem.name}
${qty} ${giveItem.unit} → ${employee.name}
Агуулахын үлдэгдэл: ${giveItem.quantity - qty} ${giveItem.unit}`
    );
    setGiveItem(null);
  };

  /** Уншсан код зөв эсэхийг шалгана (хасахгүй). */
  const resolveIssueCode = async (raw) => {
    const c = String(raw || '').trim().toLowerCase();
    if (!c) return { ok: false, error: 'Хоосон код' };
    const known = inventory.find(
      (i) =>
        String(i.barcode || '').trim().toLowerCase() === c ||
        String(i.serial_no || '').trim().toLowerCase() === c
    );
    if (known) return { ok: true, name: known.name };
    // Хайрцгийн сериал байж болно — сервер эцсийн шалгалтыг хийнэ
    return { ok: true, name: issueSession?.item?.name || c };
  };

  /** Уншуулсан бүх барааг агуулахаас хасаж, ажилтанд бүртгэнэ. */
  const submitIssueSession = async (scanned) => {
    const sess = issueSession;
    if (!sess) return;
    const total = scanned.reduce((sum, r) => sum + r.qty, 0);
    try {
      await giveItemToEmployee(sess.item, sess.employee, total, null);
      setIssueSession(null);
      await refreshInventory?.();
      Alert.alert(
        'Олгогдлоо',
        `${sess.item.name}\n${total} ${sess.item.unit} → ${sess.employee.name}\n\n` +
          scanned.map((r) => `• ${r.code} × ${r.qty}`).join('\n')
      );
    } catch (e) {
      Alert.alert('Олгох', e.message);
    }
  };

;

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
          <Text style={styles.bannerTitle}>Зөвхөн харах</Text>
          <Text style={styles.bannerText}>
            Бараа материал болон багажийг ажилтан өөрөө авах боломжгүй. Админ олгосны
            дараа «Миний үлдэгдэл» хэсэгт харагдана.
          </Text>
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

  /**
   * Жагсаалтын мөр — ЗУРАГГҮЙ.
   *
   * Өмнө нь 2 баганат зурагтай сүлжээ байсан. Нэг дэлгэцэнд 4 бараа
   * багтдаг тул хэдэн зуун нэр төрөл дундаас хайх боломжгүй байв.
   * Одоо нэр, үлдэгдлээр нь жагсаана — зураг нь нэр дээр дарахад
   * нээгдэх дэлгэрэнгүй цонхонд харагдана.
   */
  const renderItem = ({ item }) => {
    // Бараа тус бүрийн босгыг ашиглана (isLow), глобал LOW_STOCK-ыг биш.
    const low = isLow(item);
    const isOut = item.quantity <= 0;

    return (
      <TouchableOpacity
        style={[styles.row, shadow.sm]}
        activeOpacity={0.85}
        onPress={() => setDetailItem(item)}
        onLongPress={isAdmin ? () => openEdit(item) : undefined}
      >
        <View style={[styles.rowDot, { backgroundColor: isOut ? colors.danger : low ? colors.warning : colors.success }]} />

        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {showPrice ? `${formatMNT(item.price)} / ${item.unit}` : item.unit}
            {item.barcode ? ` · ▮ ${item.barcode}` : ''}
          </Text>
        </View>

        <View style={styles.rowQtyWrap}>
          <Text style={[styles.rowQty, low && { color: colors.warning }, isOut && { color: colors.danger }]}>
            {item.quantity}
          </Text>
          <Text style={styles.rowUnit}>{item.unit}</Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
              <HeaderButton
                title="Миний үлдэгдэл"
                onPress={() => navigation.navigate(category === 'tool' ? 'MyTools' : 'MyStock')}
              />
            ) : (
              <>
                {/* Код/хайрцгийн QR уншиж олгох нь одоо АДМИНы үйлдэл */}
                <HeaderButton title="Унших" onPress={openScan} />
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
        {...listPerfProps()}
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
              <Text style={styles.photoHint}>
                Зураг авахад л хангалттай — бар код заавал биш.
              </Text>
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
              {/* Хэмжих нэгж — бичихгүй, сонгоно.
                  Гараар бичихэд "ширхэг", "Ширхэг", "ш", "шир" гэх мэт
                  олон хувилбар үүсч, тайлан нэгтгэхэд тохирохгүй болдог. */}
              {!isSupply ? (
              <>
              <Text style={styles.fieldLabel}>Хэмжих нэгж</Text>
              <View style={styles.unitRow}>
                {UNITS.map((u) => {
                  const active = form.unit === u.key;
                  return (
                    <TouchableOpacity
                      key={u.key}
                      style={[styles.unitChip, active && styles.unitChipOn]}
                      onPress={() => setForm({ ...form, unit: u.key })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.unitChipText, active && styles.unitChipTextOn]}>
                        {u.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.unitHint}>
                {UNITS.find((u) => u.key === form.unit)?.hint || ''}
              </Text>
              </>
              ) : null}

              {/*
                РАЗМЕР — зөвхөн хангамж дээр.

                Хангамжид хувцас, гутал байнга ордог бөгөөд эдгээрийг
                размергүйгээр бүртгэвэл "Ажлын гутал 20ш" гэж л харагдана.
                Аль размер нь дууссаныг мэдэх боломжгүй болно.

                Размер бүрийг ТУСДАА мөр болгож хадгална — тус бүр өөрийн
                үлдэгдэлтэй. Ажилтанд XL олгоход зөвхөн XL хасагдана.
              */}
              {category === 'supply' ? (
                <>
                  <Text style={styles.fieldLabel}>Размерын төрөл</Text>
                  <View style={styles.unitRow}>
                    {SIZE_KINDS.filter((k) => k.key !== 'none').map((k) => {
                      const active = form.sizeKind === k.key;
                      return (
                        <TouchableOpacity
                          key={k.key}
                          style={[styles.unitChip, active && styles.unitChipOn]}
                          onPress={() => setForm({ ...form, sizeKind: k.key, sizeQty: {} })}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.unitChipText, active && styles.unitChipTextOn]}>
                            {k.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.unitHint}>{sizeKind(form.sizeKind).hint}</Text>
                </>
              ) : null}

              {category === 'supply' && form.sizeKind !== 'none' ? (
                <View style={styles.sizeBox}>
                  <Text style={styles.fieldLabel}>Размер бүрийн тоо</Text>
                  {sizeKind(form.sizeKind).sizes.map((sz) => (
                    <View key={sz} style={styles.sizeRow}>
                      <Text style={styles.sizeLabel}>{sz}</Text>
                      <TextInput
                        style={styles.sizeInput}
                        placeholder="0"
                        placeholderTextColor={colors.textFaint}
                        keyboardType="numeric"
                        value={form.sizeQty?.[sz] || ''}
                        onChangeText={(t) =>
                          setForm((f) => ({ ...f, sizeQty: { ...(f.sizeQty || {}), [sz]: t } }))
                        }
                      />
                    </View>
                  ))}
                  <Text style={styles.unitHint}>
                    Нийт{' '}
                    {Object.values(form.sizeQty || {}).reduce(
                      (sum, v) => sum + (Number(v) || 0),
                      0
                    )}{' '}
                    ширхэг. Тоо оруулаагүй размер бүртгэгдэхгүй.
                  </Text>
                </View>
              ) : (
              <View style={styles.twoCol}>
                <Field
                  label="Тоо хэмжээ"
                  placeholder="0"
                  keyboardType="numeric"
                  value={form.quantity}
                  onChangeText={(t) => setForm({ ...form, quantity: t })}
                  style={styles.col}
                />
                {/* Бараа тус бүрийн босго. Өмнө нь бүх бараанд 5 гэж хатуу
                    бичсэн байсан тул олон ширхэгтэй бараа хэзээ ч сануулга
                    өгдөггүй, ганц ширхэгтэй нь байнга сануулдаг байв. */}
                <Field
                  label="Бага үлдэгдлийн босго"
                  placeholder="0"
                  keyboardType="numeric"
                  value={form.min_stock}
                  onChangeText={(t) => setForm({ ...form, min_stock: t })}
                  hint="Энэ тооноос доош орвол сануулна"
                  style={styles.col}
                />
              </View>
              )}

              {showPrice ? (
                <Field
                  label="Нэгж үнэ (₮)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(t) => setForm({ ...form, price: t })}
                />
              ) : null}

              {!isSupply ? (
              <View style={styles.barcodeRow}>
                <Field
                  label="MAC / SN"
                  placeholder="Ж: 48575443F2E92EB8"
                  hint="Төхөөрөмжийн MAC хаяг эсвэл сериал дугаар"
                  value={form.barcode}
                  onChangeText={(t) => setForm({ ...form, barcode: t })}
                  style={{ flex: 1, marginBottom: 0 }}
                  autoCapitalize="characters"
                />
                <Button
                  title="Скан"
                  variant="ghost"
                  style={styles.scanBtn}
                  onPress={() => {
                    // Формын Modal нээлттэй байхад сканнерын Modal-ыг
                    // давхарлавал React Native дээр камер харагдахгүй.
                    // Тиймээс эхлээд хаана — скан дуусмагц дахин нээгдэнэ.
                    setModalVisible(false);
                    setTimeout(() => setScanMode('form'), 250);
                  }}
                />
              </View>
              ) : null}

              {/* --- Хайрцаг ---
                  Бараа нь ямар хайрцагт, хэдэн ширхэг байгааг энд заана.
                  Тусдаа "Хайрцаг" цэс рүү орох шаардлагагүй — бараа
                  бүртгэхтэй нэг урсгалд байх нь байгалийн.

                  Хангамж (хувцас, гутал) хайрцаглагддаггүй тул тэнд харагдахгүй. */}
              {isAdmin && isCloud && !isSupply ? (
                <View style={styles.boxSection}>
                  <Text style={styles.boxSectionTitle}>Хайрцаг</Text>
                  <TouchableOpacity
                    style={styles.boxSelect}
                    onPress={() => {
                      setModalVisible(false);
                      setTimeout(() => setBoxPickerOpen(true), 220);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="cube-outline" size={18} color={colors.primary} />
                    <Text style={[styles.boxSelectText, !form.boxCode && styles.boxSelectEmpty]}>
                      {form.boxCode
                        ? boxes.find((b) => b.code === form.boxCode)?.name || form.boxCode
                        : 'Хайрцаг сонгох (заавал биш)'}
                    </Text>
                    {form.boxCode ? (
                      <TouchableOpacity
                        onPress={() => setForm((f) => ({ ...f, boxCode: '', boxQty: '' }))}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                    )}
                  </TouchableOpacity>

                  {form.boxCode ? (
                    <Field
                      label="Тэр хайрцагт хэдэн ширхэг байгаа вэ *"
                      placeholder="Ж: 10"
                      keyboardType="number-pad"
                      value={form.boxQty}
                      onChangeText={(t) => setForm({ ...form, boxQty: t.replace(/[^0-9]/g, '') })}
                      hint="Хадгалахад энэ тоо тухайн хайрцагт бүртгэгдэнэ"
                      style={{ marginTop: spacing.sm, marginBottom: 0 }}
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Нэг QR дотор олон MAC/SN байвал бүгдийг нь харуулна.
                  Ингэснээр админ 10 төхөөрөмжийг гар аргаар бичихгүй. */}
              {bulkCodes.length > 1 ? (
                <View style={styles.bulkBox}>
                  <View style={styles.bulkHead}>
                    <Text style={styles.bulkTitle}>
                      Уншсан QR дотор {bulkCodes.length} MAC/SN байна
                    </Text>
                    <TouchableOpacity onPress={() => setBulkCodes([])} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                    {bulkCodes.map((c, i) => (
                      <Text key={c} style={styles.bulkCode}>
                        {i + 1}. {c}
                      </Text>
                    ))}
                  </ScrollView>
                  <Text style={styles.bulkHint}>
                    Дээрх нэр, ангилал, үнээр {bulkCodes.length} ширхэг тусдаа бүртгэл
                    үүсч, БҮГД сонгосон хайрцагт орно — тус бүр өөрийн MAC/SN-тэй.
                  </Text>
                  <Button
                    title={`Хайрцагт бүгдийг бүртгэх (${bulkCodes.length})`}
                    size="sm"
                    onPress={saveBulk}
                  />
                </View>
              ) : null}

              {!isSupply ? (
              <>
              <View style={styles.twoCol}>
                <Field
                  label="Дотоод код (SKU)"
                  placeholder="Ж: KAB-001"
                  value={form.sku}
                  onChangeText={(t) => setForm({ ...form, sku: t })}
                  autoCapitalize="characters"
                  style={styles.col}
                />
                <Field
                  label="Байршил"
                  placeholder="Ж: А агуулах, 3-р тавиур"
                  value={form.location}
                  onChangeText={(t) => setForm({ ...form, location: t })}
                  style={styles.col}
                />
              </View>

              <Field
                label="Нийлүүлэгч"
                placeholder="Хаанаас авсан бэ"
                value={form.supplier}
                onChangeText={(t) => setForm({ ...form, supplier: t })}
              />

              {/* Сериал дугаар нь зөвхөн багажид хамаатай */}
              {category === 'tool' ? (
                <Field
                  label="Сериал дугаар"
                  placeholder="Багажны үйлдвэрийн дугаар"
                  value={form.serial_no}
                  onChangeText={(t) => setForm({ ...form, serial_no: t })}
                />
              ) : null}

              <Field
                label="Тэмдэглэл"
                placeholder="Нэмэлт мэдээлэл"
                value={form.note}
                onChangeText={(t) => setForm({ ...form, note: t })}
                multiline
                numberOfLines={3}
                inputStyle={{ minHeight: 76, textAlignVertical: 'top' }}
              />
              </>
              ) : null}

              {/* --- Хэлтэс --- */}
              {/* Хэлтэс сонговол ЗӨВХӨН тэр хэлтсийнхэн харна. Сонгохгүй
                  бол нийтийн — бүх хэлтэст харагдана. */}
              <Text style={styles.deptLabel}>Хэлтэс</Text>
              {myDepartmentId ? (
                <Text style={styles.deptHint}>
                  {departments.find((d) => d.id === myDepartmentId)?.name || 'Миний хэлтэс'} —
                  та зөвхөн өөрийн хэлтэст бүртгэнэ.
                </Text>
              ) : departments.length ? (
                <View style={styles.deptChips}>
                  <TouchableOpacity
                    style={[styles.deptChip, !form.department_id && styles.deptChipOn]}
                    onPress={() => setForm({ ...form, department_id: null })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !form.department_id }}
                  >
                    <Text style={[styles.deptChipText, !form.department_id && styles.deptChipTextOn]}>
                      Нийтийн
                    </Text>
                  </TouchableOpacity>
                  {departments.map((d) => {
                    const on = form.department_id === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.deptChip, on && styles.deptChipOn]}
                        onPress={() => setForm({ ...form, department_id: d.id })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.deptChipText, on && styles.deptChipTextOn]}>
                          {deptApi.kindIcon(d.kind)} {d.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.deptHint}>
                  Хэлтэс бүртгэгдээгүй тул энэ бүртгэл нийтийнх болно.
                </Text>
              )}
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

      {/* Ажилтан өөрөө авах модал байхгүй — олголтыг зөвхөн админ хийнэ */}

      {/* --- Дэлгэрэнгүй: зураг, тоо ширхэг --- */}
      <Modal
        visible={detailItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailItem ? (
                <>
                  <View style={styles.detailImageWrap}>
                    <InventoryThumb
                      name={detailItem.name}
                      category={detailItem.category || category}
                      imageUrl={detailItem.image_url}
                      size={180}
                    />
                  </View>

                  <Text style={styles.detailName}>{detailItem.name}</Text>

                  <View style={styles.detailQtyCard}>
                    <Text style={styles.detailQtyLabel}>Агуулахын үлдэгдэл</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text
                        style={[
                          styles.detailQty,
                          isLow(detailItem) && { color: colors.warning },
                          detailItem.quantity <= 0 && { color: colors.danger },
                        ]}
                      >
                        {detailItem.quantity}
                      </Text>
                      <Text style={styles.detailQtyUnit}>{detailItem.unit}</Text>
                    </View>
                  </View>

                  {showPrice ? (
                    <DetailRow label="Нэгжийн үнэ" value={formatMNT(detailItem.price)} />
                  ) : null}
                  {detailItem.barcode ? <DetailRow label="Бар код" value={detailItem.barcode} /> : null}
                  {detailItem.serial_no ? <DetailRow label="Сериал" value={detailItem.serial_no} /> : null}
                  {detailItem.sku ? <DetailRow label="SKU" value={detailItem.sku} /> : null}
                  {detailItem.location ? <DetailRow label="Байршил" value={detailItem.location} /> : null}
                  <DetailRow
                    label="Хэлтэс"
                    value={
                      departments.find((d) => d.id === detailItem.department_id)?.name || 'Нийтийн'
                    }
                  />
                  {detailItem.supplier ? <DetailRow label="Нийлүүлэгч" value={detailItem.supplier} /> : null}
                  {detailItem.min_stock ? (
                    <DetailRow label="Доод хязгаар" value={`${detailItem.min_stock} ${detailItem.unit}`} />
                  ) : null}
                  {detailItem.note ? <DetailRow label="Тэмдэглэл" value={detailItem.note} /> : null}

                  {isAdmin ? (
                    <>
                      <View style={styles.detailActions}>
                        <Button
                          title="Олгох"
                          variant="success"
                          style={{ flex: 1 }}
                          onPress={() => {
                            const it = detailItem;
                            setDetailItem(null);
                            setTimeout(() => setGiveItem(it), 240);
                          }}
                        />
                        <Button
                          title="Засах"
                          variant="ghost"
                          style={{ flex: 1 }}
                          onPress={() => {
                            const it = detailItem;
                            setDetailItem(null);
                            setTimeout(() => openEdit(it), 240);
                          }}
                        />
                      </View>
                      <View style={styles.detailActions}>
                        <TouchableOpacity
                          style={styles.stepChip}
                          onPress={() => {
                            adjustQuantity(detailItem.id, -1);
                            setDetailItem((d) => (d ? { ...d, quantity: Math.max(0, d.quantity - 1) } : d));
                          }}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepChip}
                          onPress={() => {
                            adjustQuantity(detailItem.id, 1);
                            setDetailItem((d) => (d ? { ...d, quantity: d.quantity + 1 } : d));
                          }}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.detailDelete}
                          onPress={() => {
                            const it = detailItem;
                            setDetailItem(null);
                            setTimeout(() => handleDelete(it), 240);
                          }}
                        >
                          <Text style={styles.adminBtnDel}>Устгах</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.detailNote}>
                      Энэ зүйлийг зөвхөн админ олгоно.
                    </Text>
                  )}

                  <Button
                    title="Хаах"
                    variant="ghost"
                    style={{ marginTop: spacing.md }}
                    onPress={() => setDetailItem(null)}
                  />
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

      {/* --- Хайрцгаар бүтнээр олгох: ажилтан сонгох --- */}
      <Modal
        visible={wholeBoxCode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setWholeBoxCode(null)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>Хэнд олгох вэ?</Text>
                <Text style={styles.pickerMeta}>{wholeBoxCode} — бүтэн хайрцаг</Text>
              </View>
              <TouchableOpacity onPress={() => setWholeBoxCode(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={styles.pickerRow}
                  onPress={() => confirmWholeBox(emp)}
                >
                  <Ionicons name="person" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerName}>{emp.name || emp.email || '—'}</Text>
                    {emp.position ? <Text style={styles.pickerMeta}>{emp.position}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </TouchableOpacity>
              ))}
              {!employees.length ? (
                <Text style={styles.pickerEmpty}>Ажилтан олдсонгүй.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- Хайрцгийн агуулга (QR уншсаны дараа) --- */}
      <Modal
        visible={boxView !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setBoxView(null)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { maxHeight: '86%' }]}>
            <View style={styles.pickerHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>{boxView?.box?.name || 'Хайрцаг'}</Text>
                <Text style={styles.pickerMeta}>
                  {boxView?.box?.code || boxView?.code}
                  {boxView?.box?.location ? ` · ${boxView.box.location}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBoxView(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.boxTotals}>
              <Text style={styles.boxTotalsText}>
                {(boxView?.items || []).length} нэр төрөл · нийт{' '}
                {(boxView?.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)} ширхэг
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {(boxView?.items || []).length ? (
                boxView.items.map((it) => (
                  <View key={it.id} style={styles.boxItemRow}>
                    <Ionicons
                      name={it.category === 'tool' ? 'construct' : 'cube-outline'}
                      size={18}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{it.name}</Text>
                      {it.serial_no || it.barcode ? (
                        <Text style={styles.boxSerial}>
                          {it.serial_no || it.barcode}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.boxItemQty}>
                      {it.quantity} {it.unit || 'ш'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.pickerEmpty}>Энэ хайрцаг хоосон байна.</Text>
              )}
            </ScrollView>

            {isAdmin ? (
              <View style={styles.pickerNew}>
                <Text style={styles.issueHint}>Хэрхэн олгох вэ?</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button
                    title="Хайрцгаар бүтнээр"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const bc = boxView?.box?.code || boxView?.code;
                      setBoxView(null);
                      setTimeout(() => setWholeBoxCode(bc), 220);
                    }}
                  />
                  <Button
                    title="Ширхэгээр"
                    variant="ghost"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const bc = boxView?.box?.code || boxView?.code;
                      setBoxView(null);
                      setTimeout(() => navigation.navigate('BoxDetail', { code: bc }), 200);
                    }}
                  />
                </View>
                <Text style={styles.issueNote}>
                  Хайрцгаар — доторх бүх зүйл нэг хүнд очиж, агуулахаас хасагдана.{'\n'}
                  Ширхэгээр — код уншуулж, авсан хэмжээгээр л хасагдана.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* --- Хайрцаг сонгох --- */}
      <Modal
        visible={boxPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setBoxPickerOpen(false);
          setTimeout(() => setModalVisible(true), 220);
        }}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>Хайрцаг сонгох</Text>
              <TouchableOpacity
                onPress={() => {
                  setBoxPickerOpen(false);
                  setTimeout(() => setModalVisible(true), 220);
                }}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {boxes.length ? (
                boxes.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.pickerRow}
                    onPress={() => {
                      setForm((f) => ({ ...f, boxCode: b.code }));
                      setBoxPickerOpen(false);
                      setTimeout(() => setModalVisible(true), 220);
                    }}
                  >
                    <Ionicons name="cube" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{b.name}</Text>
                      <Text style={styles.pickerMeta}>
                        {b.code}
                        {b.location ? ` · ${b.location}` : ''}
                      </Text>
                    </View>
                    {form.boxCode === b.code ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.pickerEmpty}>
                  Хайрцаг бүртгэгдээгүй байна. Доорх талбарт кодоо бичээд шинээр үүсгэнэ үү.
                </Text>
              )}
            </ScrollView>

            {/* Шинэ хайрцаг — жагсаалтаас гарахгүйгээр */}
            <View style={styles.pickerNew}>
              <TextInput
                style={styles.pickerInput}
                placeholder="Шинэ хайрцгийн код — ж: BOX-001"
                placeholderTextColor={colors.textFaint}
                value={newBox.code}
                onChangeText={(v) => setNewBox((n) => ({ ...n, code: v.toUpperCase() }))}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.pickerInput}
                placeholder="Нэр — ж: ONT хайрцаг"
                placeholderTextColor={colors.textFaint}
                value={newBox.name}
                onChangeText={(v) => setNewBox((n) => ({ ...n, name: v }))}
              />
              <Button title="Хайрцаг үүсгэх" size="sm" onPress={createBox} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Ширхэгээр олгох — код уншуулах */}
      <MultiScanSheet
        visible={issueSession !== null}
        onClose={() => setIssueSession(null)}
        onResolve={resolveIssueCode}
        onSubmit={submitIssueSession}
        title={`${issueSession?.employee?.name || 'Ажилтан'}-д олгох`}
        hint={`${issueSession?.item?.name || ''} — код уншуулна уу`}
        submitLabel="Олгох"
      />

      <BarcodeScanner
        visible={scanMode !== null}
        onClose={closeScanner}
        onScanned={handleScanned}
        title={
          scanMode === 'take'
            ? `${meta.label} — бар код`
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

  // --- Жагсаалтын мөр (зурaггүй) ---
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowQtyWrap: { alignItems: 'flex-end', minWidth: 52 },
  rowQty: { color: colors.text, fontSize: 18, fontWeight: '900' },
  rowUnit: { color: colors.textFaint, fontSize: 10 },

  // --- Дэлгэрэнгүй цонх ---
  detailImageWrap: { alignItems: 'center', marginBottom: spacing.md },
  detailName: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  detailQtyCard: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginVertical: spacing.md,
  },
  detailQtyLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  detailQty: { color: colors.text, fontSize: 34, fontWeight: '900' },
  detailQtyUnit: { color: colors.textMuted, fontSize: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLabel: { color: colors.textMuted, fontSize: 13 },
  detailRowValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  detailDelete: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger + '55',
  },
  detailNote: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 19,
  },

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
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  unitChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  unitChipTextOn: { color: colors.onPrimary },
  // --- Размерын хүснэгт (зөвхөн хангамж) ---
  sizeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sizeLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 48,
  },
  sizeInput: {
    flex: 1,
    maxWidth: 110,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 15,
    textAlign: 'right',
  },
  unitHint: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  boxSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxSectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  boxSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxSelectText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  boxSelectEmpty: { color: colors.textFaint, fontWeight: '400' },

  bulkBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
  },
  bulkHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bulkTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  bulkCode: { color: colors.textMuted, fontSize: 12, fontFamily: undefined, paddingVertical: 1 },
  bulkHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },

  boxTotals: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  boxTotalsText: { color: colors.textMuted, fontSize: 13 },
  boxItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  boxSerial: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  boxItemQty: { color: colors.text, fontSize: 14, fontWeight: '800' },
  issueHint: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  issueNote: { color: colors.textFaint, fontSize: 11.5, lineHeight: 16, marginTop: spacing.sm },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  pickerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pickerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pickerMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  pickerEmpty: { color: colors.textMuted, fontSize: 13, padding: spacing.lg, textAlign: 'center' },
  pickerNew: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgAlt,
  },
  barcodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md },
  // Хоёр талбарыг зэрэгцүүлнэ. `flex: 1` + `minWidth: 0` нь урт шошготой
  // талбар нөгөөгөө шахахаас сэргийлнэ.
  photoHint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.sm, marginTop: -2 },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, minWidth: 0 },
  scanBtn: { paddingVertical: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  // Хэлтэс сонгох
  deptLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  deptHint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.md, lineHeight: 17 },
  deptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  deptChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  deptChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  deptChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  deptChipTextOn: { color: colors.primary },
  takePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  takeName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  takeSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
