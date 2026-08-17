import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INITIAL_INVENTORY,
  INITIAL_CALLS,
  DEFAULT_FUEL_SETTINGS,
} from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as invApi from '../services/inventoryService';
import * as authApi from '../services/authService';
import * as fuelApi from '../services/fuelService';
import * as serviceCallApi from '../services/serviceCallService';
import { calculateFuel } from '../lib/fuelCalc';
import { withoutSampleByName, withoutSampleCalls } from '../lib/sampleNames';
import { isAdminRole, isManagerRole, isSuperAdmin, canTakeServiceCalls } from '../lib/roles';
import { hasPermission } from '../lib/permissions';
import * as notificationService from '../services/notificationService';
import * as bgLocation from '../services/backgroundLocationService';
import * as shiftApi from '../services/shiftService';
import { clearLocalAccess } from '../services/localAccessService';

const AppContext = createContext(null);

const STORAGE_KEY = '@field_service_state_v1';
const PROFILE_KEY = '@me_profile_v1';

function genId() {
  return 'u_'+ Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function AppProvider({ children }) {
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [calls, setCalls] = useState(INITIAL_CALLS);
  const [fuelSettings, setFuelSettings] = useState(DEFAULT_FUEL_SETTINGS);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [profile, setProfile] = useState(null); // локал профайл (Supabase-гүй үед)

  // ---- Auth ----
  const [session, setSession] = useState(null);
  const [authProfile, setAuthProfile] = useState(null); // Supabase profiles мөр
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);

  // ---- Байршил хянах төлөв ----
  const [trackingState, setTrackingState] = useState({ active: false });
  // Ажилтан ажил дээрээ байгаа эсэх (ирснээс хойш явах хүртэл).
  // Байршил хянах нь ЗӨВХӨН энэ хугацаанд ажиллана.
  const [onShift, setOnShift] = useState(false);
  const [shiftStatus, setShiftStatus] = useState({
    checkedIn: false,
    checkedOut: false,
    onShift: false,
  });
  const [pendingVisit, setPendingVisit] = useState(null);

  // ---- Ачаалах ----
  useEffect(() => {
    (async () => {
      try {
        // Профайл (би хэн бэ)
        const prof = await AsyncStorage.getItem(PROFILE_KEY);
        if (prof) setProfile(JSON.parse(prof));

        // Дуудлага, бензин, тохиргоо нь локалд хадгалагдана
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !isSupabaseConfigured) {
          const data = JSON.parse(raw);
          if (data.calls) setCalls(withoutSampleCalls(data.calls));
          if (data.fuelSettings) setFuelSettings(data.fuelSettings);
          if (data.fuelLogs) setFuelLogs(data.fuelLogs);
          if (data.inventory) setInventory(data.inventory);
        } else if (raw) {
          const data = JSON.parse(raw);
          if (data.fuelSettings) setFuelSettings(data.fuelSettings);
          if (data.fuelLogs) setFuelLogs(data.fuelLogs);
        }

        // Бараа материал ба ажилтан — Supabase-ээс
        if (isSupabaseConfigured) {
          setInventory(await invApi.fetchInventory());
          try {
            setFuelSettings(await fuelApi.fetchFuelSettings());
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Ачаалахад алдаа:', e);
        setSyncError(e.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ---- Хадгалах (локал өгөгдөл) ----
  useEffect(() => {
    if (!loaded) return;
    const payload = { fuelSettings, fuelLogs };
    if (!isSupabaseConfigured) {
      payload.calls = calls;
      payload.inventory = inventory;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((e) =>
      console.warn('Хадгалахад алдаа:', e)
    );
  }, [inventory, calls, fuelSettings, fuelLogs, loaded]);

  // ---- Auth: session + профайл сонсох ----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;

    const loadProfile = async (sess) => {
      if (!sess?.user) {
        if (mounted) setAuthProfile(null);
        return;
      }
      try {
        const p = await authApi.syncProfileAfterAuth();
        if (mounted) {
          setAuthProfile(p);
          setAuthError(null);
        }
      } catch (e) {
        if (mounted) {
          setAuthProfile(null);
          setAuthError(e.message || 'Энэ Gmail хаяг зөвшөөрөгдөөгүй байна.');
        }
        await authApi.signOut();
      }
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (mounted) setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      loadProfile(sess);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setAuthError(null);
    await authApi.signIn(email, password);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      return await authApi.signInWithGoogle();
    } catch (e) {
      setAuthError(e.message);
      throw e;
    }
  };

  const signOut = async () => {
    const userId = session?.user?.id;
    if (userId) await notificationService.removePushToken(userId).catch(() => {});
    if (userId) await clearLocalAccess(userId).catch(() => {});
    // Арын байршлын task нь OS түвшинд бүртгэгддэг тул гарахад заавал
    // зогсоохгүй бол нэвтрээгүй байхад ч байршил илгээсээр байна.
    await bgLocation.stopTracking().catch(() => {});
    await authApi.signOut();
    setAuthProfile(null);
    setSession(null);
  };

  const updateMyProfile = async (patch) => {
    if (!authProfile) return;
    const employeeAllowed = new Set([
      'report_signature_url',
      'latitude',
      'longitude',
      'last_seen',
      'face_uuid',
      'face_enrolled',
      'must_change_password',
      'avatar_url',
    ]);
    if (!isAdminRole(authProfile.role)) {
      const blocked = Object.keys(patch).filter((k) => !employeeAllowed.has(k));
      if (blocked.length) {
        throw new Error('Өөрийн мэдээллийг зөвхөн админ засна.');
      }
    }
    const updated = await authApi.updateProfile(authProfile.id, patch);
    setAuthProfile(updated);
  };

  const adminCreateEmployee = async (payload) => {
    return authApi.adminCreateEmployee(payload);
  };

  const adminUpdateEmployee = async (userId, patch) => {
    return authApi.adminUpdateEmployee(userId, patch);
  };

  const adminResetUserPassword = async (userId, newPassword, forceChange = true) => {
    return authApi.adminResetUserPassword(userId, newPassword, forceChange);
  };

  const changePassword = async (newPassword) => {
    await authApi.changeMyPassword(newPassword);
    if (authProfile) setAuthProfile({ ...authProfile, must_change_password: false });
  };

  /**
   * Өнөөдрийн ирцийн төлвийг сэргээнэ.
   *
   * Ирц бүртгэсний дараа дуудна — LocationTracker үүнийг хараад байршил
   * хянахыг асаах/унтраахаа шийднэ.
   */
  const refreshShiftStatus = useCallback(async () => {
    const uid = authProfile?.id;
    if (!isSupabaseConfigured || !uid) {
      setOnShift(false);
      setShiftStatus({ checkedIn: false, checkedOut: false, onShift: false });
      return;
    }
    try {
      const st = await shiftApi.fetchTodayStatus(uid);
      setShiftStatus(st);
      setOnShift(st.onShift);
    } catch (e) {
      // Сүлжээгүй үед өмнөх төлвийг хэвээр үлдээнэ — хяналтыг санамсаргүй
      // унтраах нь мэдээлэл алдагдуулна.
    }
  }, [authProfile?.id]);

  // Нэвтэрсэн/өдөр солигдоход төлвийг шинэчилнэ
  useEffect(() => {
    refreshShiftStatus();
  }, [refreshShiftStatus]);

  const fetchEmployees = async () => authApi.fetchEmployees();
  /** Чат/пост/лавлахад — эрхээс үл хамааран бүх хамт олон. */
  const fetchDirectory = async () => authApi.fetchDirectory();

  const isSuperAdminUser = isSuperAdmin(authProfile?.role);
  const isAdmin = isAdminRole(authProfile?.role);
  /**
   * Ахлах (менежер) ба түүнээс дээш.
   *
   * `isAdmin`-аас ялгаатай: ахлах багтана. Ахлах ажилтан, агуулахаа
   * удирдана — гэхдээ ЗӨВХӨН ӨӨРИЙН ХЭЛТСИЙНХЭЭ (шүүлт нь серверийн
   * RLS болон `roles.js` дээр).
   */
  const isManager = isManagerRole(authProfile?.role);
  const departmentId = authProfile?.department_id || null;
  /** Нарийвчилсан эрх — түвшний утга + хөгжүүлэгчийн тусгай тохиргоо. */
  const can = useCallback((key) => hasPermission(authProfile, key), [authProfile]);
  const mustChangePassword = !!authProfile?.must_change_password;
  // Чат/ирцэд ашиглах нэгдсэн хэрэглэгч
  const currentUser = authProfile
    // role/email зэрэг эрхийн талбаруудыг хаяж болохгүй. Attendance зэрэг
    // хамгаалалттай дэлгэц хэрэглэгч хөгжүүлэгч эсэхийг үүгээр шийддэг.
    ? { ...authProfile, id: authProfile.id, name: authProfile.name }
    : profile;

  // ---- Профайл (Supabase-гүй үед) ----
  const saveProfile = async (name) => {
    const next = { id: profile?.id || genId(), name: name.trim() };
    setProfile(next);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  };

  // ---- Бараа материалын үйлдлүүд ----
  const addInventoryItem = async (item) => {
    const draft = { quantity: 0, price: 0, unit: 'ширхэг', ...item };
    if (isSupabaseConfigured) {
      try {
        const saved = await invApi.insertInventory(draft);
        setInventory((prev) => [saved, ...prev]);
        return;
      } catch (e) {
        setSyncError(e.message);
      }
    }
    setInventory((prev) => [{ id: Date.now().toString(), ...draft }, ...prev]);
  };

  const updateInventoryItem = async (id, patch) => {
    setInventory((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    if (isSupabaseConfigured) {
      try {
        await invApi.updateInventory(id, patch);
      } catch (e) {
        setSyncError(e.message);
      }
    }
  };

  const adjustQuantity = async (id, delta) => {
    let next = 0;
    setInventory((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        next = Math.max(0, it.quantity + delta);
        return { ...it, quantity: next };
      })
    );
    if (isSupabaseConfigured) {
      try {
        await invApi.updateInventory(id, { quantity: next });
      } catch (e) {
        setSyncError(e.message);
      }
    }
  };

  const removeInventoryItem = async (id) => {
    setInventory((prev) => prev.filter((it) => it.id !== id));
    if (isSupabaseConfigured) {
      try {
        await invApi.deleteInventory(id);
      } catch (e) {
        setSyncError(e.message);
      }
    }
  };

  /**
   * Бараа/багаж олгох — ЗӨВХӨН админ.
   *
   * Ажилтан өөрөө агуулахаас хасах (withdrawItem) зам байсныг санаатай
   * устгасан: хэн юуг авсныг зөвхөн олгосон админ баталгаажуулна.
   */
  const giveItemToEmployee = async (item, employee, qty, photoUrl) => {
    const q = Math.max(1, Number(qty) || 0);
    const newQty = Math.max(0, item.quantity - q);
    setInventory((prev) => prev.map((it) => (it.id === item.id ? { ...it, quantity: newQty } : it)));
    if (isSupabaseConfigured) {
      try {
        await invApi.withdrawInventory({
          item,
          userId: employee.id,
          userName: employee.name || employee.email || 'Ажилтан',
          qty: q,
          photoUrl,
        });
      } catch (e) {
        setSyncError(e.message);
        throw e;
      }
    }
    return newQty;
  };

  const fetchStockMovements = async (mineOnly) => {
    if (!isSupabaseConfigured) return [];
    return mineOnly
      ? invApi.fetchMyMovements(currentUser?.id)
      : invApi.fetchMovements();
  };

  const fetchMyStock = async () => {
    if (!isSupabaseConfigured || !currentUser?.id) return [];
    return invApi.fetchMyBalances(currentUser.id, inventory);
  };

  const consumeItem = async (balanceRow, qty) => {
    const q = Math.max(1, Number(qty) || 0);
    if (!isSupabaseConfigured) {
      throw new Error('Зөвхөн онлайн горимд хэрэглэнэ');
    }
    const item = inventory.find((it) => it.id === balanceRow.item_id) || {
      id: balanceRow.item_id,
      name: balanceRow.item_name,
      unit: balanceRow.unit,
    };
    return invApi.consumeInventory({
      item,
      userId: currentUser?.id,
      userName: currentUser?.name,
      qty: q,
    });
  };

  const getItemByBarcode = (barcode) => {
    const code = String(barcode || '').trim();
    if (!code) return null;
    return inventory.find((it) => String(it.barcode || '').trim() === code) || null;
  };

  const refreshInventory = async () => {
    if (!isSupabaseConfigured) return;
    try {
      setInventory(await invApi.fetchInventory());
    } catch (e) {
      setSyncError(e.message);
    }
  };

  // ---- Дуудлага (Supabase эсвэл локал) ----
  const refreshCalls = useCallback(async (profile = authProfile) => {
    if (!isSupabaseConfigured) return;
    if (!profile || !canTakeServiceCalls(profile)) {
      setCalls([]);
      return;
    }
    try {
      const list = await serviceCallApi.fetchServiceCalls({
        engineerId: profile.id,
        engineerName: profile.name,
      });
      setCalls(withoutSampleCalls(list));
    } catch (e) {
      setSyncError(e.message);
    }
  }, [authProfile?.id, authProfile?.name, authProfile?.role, authProfile?.can_take_calls]);

  useEffect(() => {
    if (!loaded || !isSupabaseConfigured || !authProfile) return;
    refreshCalls(authProfile);
  }, [loaded, authProfile?.id, authProfile?.role, authProfile?.can_take_calls]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authProfile || !canTakeServiceCalls(authProfile)) return;
    const unsub = serviceCallApi.subscribeServiceCalls(() => refreshCalls(authProfile));
    return unsub;
  }, [authProfile?.id, authProfile?.role, authProfile?.can_take_calls]);

  const addCall = async (call) => {
    if (isSupabaseConfigured) {
      const created = await serviceCallApi.createServiceCall({
        ...call,
        engineer_name: call.engineer,
        created_by: authProfile?.id,
      });
      if (!isAdminRole(authProfile?.role)) {
        setCalls((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      }
      return created;
    }
    const local = { id: Date.now().toString(), status: 'Хүлээгдэж буй', ...call };
    setCalls((prev) => [local, ...prev]);
    return local;
  };

  const updateCallStatus = async (id, status) => {
    if (isSupabaseConfigured) {
      const updated = await serviceCallApi.updateServiceCallStatus(id, status);
      setCalls((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    }
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const closeCall = async (id, meta) => {
    const by = authProfile?.name || currentUser?.name || 'Инженер';
    const existing = calls.find((c) => c.id === id)?.close_meta || {};
    const close_meta = { ...existing, ...meta, closed_by: by, closed_at: meta.closed_at || new Date().toISOString() };
    if (isSupabaseConfigured) {
      const updated = await serviceCallApi.updateServiceCall(id, { status: 'Дууссан', close_meta });
      setCalls((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    }
    const local = { status: 'Дууссан', close_meta };
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...local } : c)));
    return local;
  };

  const transferCall = async (id, meta) => {
    const by = authProfile?.name || currentUser?.name || 'Инженер';
    const at = new Date().toISOString();
    const existing = calls.find((c) => c.id === id)?.close_meta || {};
    const isReschedule = meta.type === 'Dahimdah' || meta.type === 'Reschedule';
    const transfer = { type: meta.type, reason: meta.reason || '', comment: meta.comment || '', by, at };
    const patch = { close_meta: { ...existing, transfer } };
    if (isReschedule) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      patch.status = 'Дахимдах';
      patch.scheduled_at = t.toISOString();
    } else {
      patch.status = 'Татгалзсан';
    }
    if (isSupabaseConfigured) {
      const updated = await serviceCallApi.updateServiceCall(id, patch);
      setCalls((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    }
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    return patch;
  };

  // ---- Бензиний тооцоо (локал) ----
  const updateFuelSettings = async (patch) => {
    const next = { ...fuelSettings, ...patch };
    setFuelSettings(next);
    if (isSupabaseConfigured) {
      try {
        const saved = await fuelApi.saveFuelSettings(next);
        setFuelSettings(saved);
      } catch (e) {
        setSyncError(e.message);
      }
    }
  };

  const addFuelLog = ({ km, idleSeconds = 0, liters: litersIn, cost: costIn }) => {
    const { liters, cost } =
      litersIn != null && costIn != null
        ? { liters: litersIn, cost: costIn }
        : calculateFuel({
            distanceKm: km,
            idleSeconds,
            litersPer100km: fuelSettings.litersPer100km,
            idleLitersPerHour: fuelSettings.idleLitersPerHour,
            pricePerLiter: fuelSettings.pricePerLiter,
          });
    const log = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      km,
      idleSeconds,
      liters,
      cost,
    };
    setFuelLogs((prev) => [log, ...prev]);
    return log;
  };

  const removeFuelLog = (id) => {
    setFuelLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const value = {
    loaded,
    syncError,
    isCloud: isSupabaseConfigured,
    profile,
    saveProfile,
    // auth
    session,
    authProfile,
    authLoading,
    authError,
    isAdmin,
    isManager,
    isSuperAdmin: isSuperAdminUser,
    departmentId,
    can,
    mustChangePassword,
    currentUser,
    signIn,
    signInWithGoogle,
    signOut,
    updateMyProfile,
    adminCreateEmployee,
    adminUpdateEmployee,
    adminResetUserPassword,
    changePassword,
    fetchEmployees,
    fetchDirectory,
    onShift,
    shiftStatus,
    refreshShiftStatus,
    inventory,
    addInventoryItem,
    updateInventoryItem,
    adjustQuantity,
    removeInventoryItem,
    giveItemToEmployee,
    consumeItem,
    fetchMyStock,
    fetchStockMovements,
    getItemByBarcode,
    refreshInventory,
    calls,
    addCall,
    updateCallStatus,
    closeCall,
    transferCall,
    refreshCalls,
    fuelSettings,
    updateFuelSettings,
    fuelLogs,
    addFuelLog,
    removeFuelLog,
    // байршил хянах
    trackingState,
    setTrackingState,
    pendingVisit,
    setPendingVisit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp-г AppProvider дотор ашиглана уу');
  return ctx;
}
