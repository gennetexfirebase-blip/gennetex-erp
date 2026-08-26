import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, View, Text, ActivityIndicator, Image } from 'react-native';
import { APP_VERSION_LABEL } from './src/version';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FaceDetectionProvider } from './src/lib/faceDetection';

import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CallProvider } from './src/context/CallContext';
import LoginScreen from './src/screens/LoginScreen';
import LocalAccessScreen from './src/screens/LocalAccessScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingPermissionsScreen from './src/screens/OnboardingPermissionsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ToolsHubScreen from './src/screens/ToolsHubScreen';
import FuelScreen from './src/screens/FuelScreen';
import FleetFuelScreen from './src/screens/FleetFuelScreen';
import LiveLocationScreen from './src/screens/LiveLocationScreen';
import CallsMapScreen from './src/screens/CallsMapScreen';
import AdminCallsScreen from './src/screens/AdminCallsScreen';
import AdminVisitsScreen from './src/screens/AdminVisitsScreen';
import CallDetailScreen from './src/screens/CallDetailScreen';
import CallHistoryScreen from './src/screens/CallHistoryScreen';
import BoxesScreen from './src/screens/BoxesScreen';
import BoxDetailScreen from './src/screens/BoxDetailScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import MyShiftScreen from './src/screens/MyShiftScreen';
import AttendanceRequestFormScreen from './src/screens/AttendanceRequestFormScreen';
import AttendanceMonthlySummaryScreen from './src/screens/AttendanceMonthlySummaryScreen';
import AttendanceHistoryScreen from './src/screens/AttendanceHistoryScreen';
import AttendanceDetailScreen from './src/screens/AttendanceDetailScreen';
import AttendanceRequestsScreen from './src/screens/AttendanceRequestsScreen';
import PayrollAdminScreen from './src/screens/PayrollAdminScreen';
import MyPayrollScreen from './src/screens/MyPayrollScreen';
import ChatScreen from './src/screens/ChatScreen';
import FeedScreen from './src/screens/FeedScreen';
import FeedProfileScreen from './src/screens/FeedProfileScreen';
import FeedSearchScreen from './src/screens/FeedSearchScreen';
import FeedPostScreen from './src/screens/FeedPostScreen';
import ConversationScreen from './src/screens/ConversationScreen';
import TelegramChatScreen from './src/screens/TelegramChatScreen';
import MyTelegramScreen from './src/screens/MyTelegramScreen';
import TelegramDialogScreen from './src/screens/TelegramDialogScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import DepartmentsScreen from './src/screens/DepartmentsScreen';
import DepartmentDetailScreen from './src/screens/DepartmentDetailScreen';
import UserPermissionsScreen from './src/screens/UserPermissionsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import VehicleScreen from './src/screens/VehicleScreen';
import VehiclesAdminScreen from './src/screens/VehiclesAdminScreen';
import VehicleSpecsScreen from './src/screens/VehicleSpecsScreen';
import StockLogScreen from './src/screens/StockLogScreen';
import MyStockScreen from './src/screens/MyStockScreen';
import ToolAllocationScreen from './src/screens/ToolAllocationScreen';
import EmployeeReportScreen from './src/screens/EmployeeReportScreen';
import RequisitionScreen from './src/screens/RequisitionScreen';
import AdminReportsScreen from './src/screens/AdminReportsScreen';
import AdminPerformanceScreen from './src/screens/AdminPerformanceScreen';
import AdminWorkPerformanceScreen from './src/screens/AdminWorkPerformanceScreen';
import AdminAppUsageScreen from './src/screens/AdminAppUsageScreen';
import AdminFeedbackScreen from './src/screens/AdminFeedbackScreen';
import AdminOhaabScreen from './src/screens/AdminOhaabScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import OhaabScreen from './src/screens/OhaabScreen';
import OhaabGateScreen from './src/screens/OhaabGateScreen';
import DeviceGateScreen from './src/screens/DeviceGateScreen';
import AdminDevicesScreen from './src/screens/AdminDevicesScreen';
import AdminApplicationsScreen from './src/screens/AdminApplicationsScreen';
import AdminContractsScreen from './src/screens/AdminContractsScreen';
import MyContractScreen from './src/screens/MyContractScreen';
import SiteWorkScreen from './src/screens/SiteWorkScreen';
import EmployeeDirectoryScreen from './src/screens/EmployeeDirectoryScreen';
import ChatArchiveScreen from './src/screens/ChatArchiveScreen';
import ChatSharedScreen from './src/screens/ChatSharedScreen';
import GennetexAiScreen from './src/screens/GennetexAiScreen';
import AiAdminScreen from './src/screens/AiAdminScreen';
import MeetingScreen from './src/screens/MeetingScreen';
import DeveloperContactScreen from './src/screens/DeveloperContactScreen';
import DeveloperInboxScreen from './src/screens/DeveloperInboxScreen';
import AddGroupMembersScreen from './src/screens/AddGroupMembersScreen';
import AiInventoryHomeScreen from './src/screens/ai-inventory/AiInventoryHomeScreen';
import InventoryCameraScreen from './src/screens/ai-inventory/InventoryCameraScreen';
import InventoryResultScreen from './src/screens/ai-inventory/InventoryResultScreen';
import InventoryHistoryScreen from './src/screens/ai-inventory/InventoryHistoryScreen';
import ProductTrainingScreen from './src/screens/ai-inventory/ProductTrainingScreen';
import InventorySettingsScreen from './src/screens/ai-inventory/InventorySettingsScreen';
import LiveOpsScreen from './src/screens/enhancements/LiveOpsScreen';
import SlaReportScreen from './src/screens/enhancements/SlaReportScreen';
import LowStockScreen from './src/screens/enhancements/LowStockScreen';
import AutoDispatchScreen from './src/screens/enhancements/AutoDispatchScreen';
import RouteOptimizeScreen from './src/screens/enhancements/RouteOptimizeScreen';
import KnowledgeBaseScreen from './src/screens/enhancements/KnowledgeBaseScreen';
import PayrollExportScreen from './src/screens/enhancements/PayrollExportScreen';
import CallCostScreen from './src/screens/enhancements/CallCostScreen';
import ToolCheckInScreen from './src/screens/enhancements/ToolCheckInScreen';
import PredictiveScreen from './src/screens/enhancements/PredictiveScreen';
import DigitalTwinScreen from './src/screens/enhancements/DigitalTwinScreen';
import TodayDetailScreen from './src/screens/enhancements/TodayDetailScreen';
import OfflineQueueScreen from './src/screens/enhancements/OfflineQueueScreen';
import BranchAdminScreen from './src/screens/enhancements/BranchAdminScreen';
import FeatureFlagsScreen from './src/screens/enhancements/FeatureFlagsScreen';
import BarcodeModeScreen from './src/screens/enhancements/BarcodeModeScreen';
import PublicTicketsScreen from './src/screens/enhancements/PublicTicketsScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import LocationTracker from './src/components/LocationTracker';
import SiteVisitVerifier from './src/components/SiteVisitVerifier';
import CallHost from './src/components/CallHost';
import IncomingLiveInviteManager from './src/components/IncomingLiveInviteManager';
import PushNotificationManager from './src/components/PushNotificationManager';
import ActivityLogger from './src/components/ActivityLogger';
import ScreenLiveShare from './src/components/ScreenLiveShare';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineGate from './src/components/OfflineGate';
import ForceUpdateModal from './src/components/enhancements/ForceUpdateModal';
import OfflineSyncBanner from './src/components/enhancements/OfflineSyncBanner';
import TabBar from './src/components/TabBar';
import { flushPendingNotification, navigationRef } from './src/lib/navigationRef';
import { ONBOARDING_KEY } from './src/services/permissionsService';
import * as ohaabApi from './src/services/ohaabService';
import * as deviceApi from './src/services/deviceAuthService';
import { loadFeatureFlagOverrides } from './src/lib/featureFlags';
import { initPerformanceMode } from './src/lib/performanceMode';
import { installGlobalCrashHandlers } from './src/services/crashReportService';
import { startOfflineSyncWatcher } from './src/services/offlineQueueService';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function buildNavTheme(colors, isDark) {
  // React Navigation-ы дотоод хэсэг (modal дэвсгэр, шилжилтийн анимаци) `dark`
  // тугнаас хамаардаг тул үндсэн сэдвийг горимд нь тааруулж авна.
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Нүүр' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Ирц' }} />
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Пост' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профайл' }} />
      <Tab.Screen name="Notifications" component={NotificationCenterScreen} options={{ title: 'Мэдэгдэл' }} />
    </Tab.Navigator>
  );
}

function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Inventory" component={InventoryScreen} initialParams={{ category: 'material', mode: 'manage' }} />
      <Stack.Screen name="Tools" component={InventoryScreen} initialParams={{ category: 'tool', mode: 'manage' }} />
      {/* "Багаж, хангамж" төв цэс — Багаж / Хангамж / Бараа материал руу сална. */}
      <Stack.Screen name="ToolsHub" component={ToolsHubScreen} />
      <Stack.Screen name="Supplies" component={InventoryScreen} initialParams={{ category: 'supply', mode: 'manage' }} />
      <Stack.Screen name="Fuel" component={FuelScreen} />
      <Stack.Screen name="FleetFuel" component={FleetFuelScreen} />
      <Stack.Screen name="Live" component={LiveLocationScreen} />
      <Stack.Screen name="Calls" component={CallsMapScreen} />
      <Stack.Screen name="AdminCalls" component={AdminCallsScreen} />
      <Stack.Screen name="AdminVisits" component={AdminVisitsScreen} />
      <Stack.Screen name="CallDetail" component={CallDetailScreen} />
      {/* "Calls" нь үйлчилгээний дуудлага (ажлын захиалга). Энэ нь ажилтан
          хоорондын дуут/видео дуудлагын түүх — нэр давхцуулахгүй. */}
      <Stack.Screen name="Boxes" component={BoxesScreen} options={{ title: 'Хайрцаг' }} />
      <Stack.Screen name="BoxDetail" component={BoxDetailScreen} options={{ title: 'Хайрцгийн агуулга' }} />
      <Stack.Screen
        name="CallHistory"
        component={CallHistoryScreen}
        options={{ title: 'Дуудлагын түүх' }}
      />
      <Stack.Screen name="Vehicle" component={VehicleScreen} />
      <Stack.Screen name="VehiclesAdmin" component={VehiclesAdminScreen} />
      <Stack.Screen name="VehicleSpecs" component={VehicleSpecsScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="TelegramChat" component={TelegramChatScreen} options={{ title: 'Telegram чат' }} />
      <Stack.Screen name="MyTelegram" component={MyTelegramScreen} options={{ title: 'Миний Telegram' }} />
      <Stack.Screen name="TelegramDialog" component={TelegramDialogScreen} options={{ title: 'Telegram чат' }} />
      <Stack.Screen name="NewGroup" component={NewGroupScreen} />
      <Stack.Screen name="Employees" component={EmployeesScreen} />
      {/* Хэлтэс — байгууллага ба өрх. Хүн, бараа, багажийн эрхийн хил. */}
      <Stack.Screen name="Departments" component={DepartmentsScreen} options={{ title: 'Хэлтэс' }} />
      <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} options={{ title: 'Хэлтсийн мэдээлэл' }} />
      <Stack.Screen name="UserPermissions" component={UserPermissionsScreen} options={{ title: 'Эрхийн тохиргоо' }} />
      <Stack.Screen name="StockLog" component={StockLogScreen} />
      <Stack.Screen name="ToolAllocation" component={ToolAllocationScreen} initialParams={{ category: 'tool' }} />
      <Stack.Screen name="MyStock" component={MyStockScreen} initialParams={{ category: 'material' }} />
      <Stack.Screen name="MyTools" component={MyStockScreen} initialParams={{ category: 'tool' }} />
      <Stack.Screen name="EmployeeReport" component={EmployeeReportScreen} />
      <Stack.Screen name="Requisition" component={RequisitionScreen} />
      <Stack.Screen name="MyShift" component={MyShiftScreen} />
      <Stack.Screen name="AttendanceRequestForm" component={AttendanceRequestFormScreen} />
      <Stack.Screen name="AttendanceMonthlySummary" component={AttendanceMonthlySummaryScreen} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="AttendanceDetail" component={AttendanceDetailScreen} />
      <Stack.Screen name="AttendanceRequests" component={AttendanceRequestsScreen} />
      <Stack.Screen name="Payroll" component={PayrollAdminScreen} options={{ title: 'Цалин' }} />
      <Stack.Screen name="MyPayroll" component={MyPayrollScreen} options={{ title: 'Миний цалин' }} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminFeedback" component={AdminFeedbackScreen} />
      <Stack.Screen name="AdminOhaab" component={AdminOhaabScreen} />
      <Stack.Screen name="AdminPerformance" component={AdminPerformanceScreen} />
      <Stack.Screen name="AdminWorkPerformance" component={AdminWorkPerformanceScreen} />
      <Stack.Screen name="AdminAppUsage" component={AdminAppUsageScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Ohaab" component={OhaabScreen} />
      <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
      <Stack.Screen name="AdminApplications" component={AdminApplicationsScreen} />
      <Stack.Screen name="AdminContracts" component={AdminContractsScreen} />
      <Stack.Screen name="MyContract" component={MyContractScreen} />
      <Stack.Screen name="SiteWork" component={SiteWorkScreen} />
      <Stack.Screen name="EmployeeDirectory" component={EmployeeDirectoryScreen} />
      <Stack.Screen name="ChatArchive" component={ChatArchiveScreen} />
      <Stack.Screen name="ChatShared" component={ChatSharedScreen} />
      <Stack.Screen name="GennetexAi" component={GennetexAiScreen} />
      <Stack.Screen name="AiAdmin" component={AiAdminScreen} />
      <Stack.Screen name="Meeting" component={MeetingScreen} />
      <Stack.Screen name="DeveloperContact" component={DeveloperContactScreen} />
      <Stack.Screen name="DeveloperInbox" component={DeveloperInboxScreen} />
      <Stack.Screen name="FeedProfile" component={FeedProfileScreen} />
      <Stack.Screen name="FeedSearch" component={FeedSearchScreen} />
      <Stack.Screen name="FeedPost" component={FeedPostScreen} />
      <Stack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} />
      <Stack.Screen name="AiInventoryHome" component={AiInventoryHomeScreen} />
      <Stack.Screen name="InventoryCamera" component={InventoryCameraScreen} />
      <Stack.Screen name="InventoryResult" component={InventoryResultScreen} />
      <Stack.Screen name="InventoryHistory" component={InventoryHistoryScreen} />
      <Stack.Screen name="ProductTraining" component={ProductTrainingScreen} />
      <Stack.Screen name="InventorySettings" component={InventorySettingsScreen} />
      {/* --- Enhancements (additive, existing modules unchanged) --- */}
      <Stack.Screen name="LiveOps" component={LiveOpsScreen} />
      <Stack.Screen name="SlaReport" component={SlaReportScreen} />
      <Stack.Screen name="LowStock" component={LowStockScreen} />
      <Stack.Screen name="AutoDispatch" component={AutoDispatchScreen} />
      <Stack.Screen name="RouteOptimize" component={RouteOptimizeScreen} />
      <Stack.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} />
      <Stack.Screen name="PayrollExport" component={PayrollExportScreen} />
      <Stack.Screen name="CallCost" component={CallCostScreen} />
      <Stack.Screen name="ToolCheckIn" component={ToolCheckInScreen} />
      <Stack.Screen name="Predictive" component={PredictiveScreen} />
      <Stack.Screen name="DigitalTwin" component={DigitalTwinScreen} />
      <Stack.Screen name="TodayDetail" component={TodayDetailScreen} />
      <Stack.Screen name="OfflineQueue" component={OfflineQueueScreen} />
      <Stack.Screen name="BranchAdmin" component={BranchAdminScreen} />
      <Stack.Screen name="FeatureFlags" component={FeatureFlagsScreen} />
      <Stack.Screen name="BarcodeMode" component={BarcodeModeScreen} />
      <Stack.Screen name="PublicTickets" component={PublicTicketsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
    </Stack.Navigator>
  );
}

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('./assets/logo.png')} style={{ width: 180, height: 150, marginBottom: 24 }} resizeMode="contain" />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 20, color: colors.textMuted, fontSize: 12, letterSpacing: 0.3 }}>
        {APP_VERSION_LABEL}
      </Text>
    </View>
  );
}

function Root({ shareRef }) {
  const { isCloud, authLoading, session, mustChangePassword, currentUser, authProfile, isSuperAdmin, signOut } = useApp();
  const [onboarded, setOnboarded] = useState(null);
  const [ohaabOk, setOhaabOk] = useState(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [localUnlocked, setLocalUnlocked] = useState(false);

  useEffect(() => {
    setLocalUnlocked(false);
  }, [session?.user?.id]);

  /**
   * Ар тал руу орсны дараа хэдийд дахин түгжих вэ.
   *
   * ⚠️ ЗАСВАР: урьд нь `background` болмогц ШУУД түгждэг байсан. Гэвч
   *    камер/микрофоны зөвшөөрлийн цонх, дэлгэц хуваалцах хүсэлт, Jitsi
   *    зэрэг нь аппыг хормын төдийд ар тал руу гаргадаг. Үүнээс болж
   *    "Live" эсвэл дуут бичлэг дарахад л PIN дэлгэц үсэрч, ажил
   *    тасалддаг байв.
   *
   *    Одоо ар талд ТОДОРХОЙ ХУГАЦААНААС удаан байсан үед л түгжинэ.
   *    Аюулгүй байдал хэвээр — утсаа орхиод явбал түгжигдэнэ, харин
   *    системийн цонх гарч ирээд буцахад түгжихгүй.
   */
  const backgroundedAt = useRef(null);
  const LOCK_AFTER_MS = 60 * 1000;

  useEffect(() => {
    if (!session) return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (nextState === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (away > LOCK_AFTER_MS) setLocalUnlocked(false);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isCloud || !session) {
      setOnboarded(null);
      return;
    }
    let active = true;
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => {
      if (active) setOnboarded(v === '1');
    });
    return () => {
      active = false;
    };
  }, [isCloud, session?.user?.id]);

  // Апп руу орохын өмнө: шинэ төхөөрөмж бол системийн админы зөвшөөрөл шаардлагатай.
  // Системийн админыг (superadmin) шалгахгүй.
  useEffect(() => {
    if (!isCloud || !session || !currentUser?.id) {
      setDeviceOk(true);
      return;
    }
    if (isSuperAdmin) {
      setDeviceOk(true);
      return;
    }
    let active = true;
    setDeviceOk(null);
    (async () => {
      try {
        const res = await deviceApi.ensureDeviceApproval({
          id: currentUser.id,
          name: authProfile?.name || currentUser?.name,
        });
        if (!active) return;
        setDeviceInfo(res);
        setDeviceOk(res.status === 'approved');
      } catch (e) {
        if (active) setDeviceOk(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCloud, session?.user?.id, currentUser?.id, isSuperAdmin]);

  // Апп руу орохын өмнө: өнөөдрийн ХААБ зааврыг гарын үсгээр баталсан эсэх.
  // Системийн админ (superadmin) ХААБ баталгаажуулалтыг алгасана.
  useEffect(() => {
    if (!isCloud || !session || !currentUser?.id) {
      setOhaabOk(true);
      return;
    }
    if (isSuperAdmin) {
      setOhaabOk(true);
      return;
    }
    let active = true;
    setOhaabOk(null);
    (async () => {
      try {
        const [signed, inst] = await Promise.all([
          ohaabApi.hasTodayAck(currentUser.id),
          ohaabApi.fetchInstruction(),
        ]);
        const needs = !signed && !!(inst?.body || '').trim();
        if (active) setOhaabOk(!needs);
      } catch (e) {
        // Алдаа гарвал хатуу блоклохгүй
        if (active) setOhaabOk(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCloud, session?.user?.id, currentUser?.id, isSuperAdmin]);

  if (isCloud) {
    if (authLoading) return <Splash />;
    if (!session) return <LoginScreen />;
    if (!localUnlocked) {
      return (
        <LocalAccessScreen
          userId={session.user.id}
          // Түгжээний дэлгэц дээр "энэ хэн бэ" гэдэг харагдана. Профайл
          // хараахан ачаалагдаагүй байж болзошгүй тул Google-ийн өгсөн
          // мэдээллийг нөөцөөр ашиглана.
          name={
            authProfile?.name
            || session.user.user_metadata?.full_name
            || session.user.user_metadata?.name
            || session.user.email
          }
          avatarUrl={authProfile?.avatar_url || session.user.user_metadata?.avatar_url}
          onUnlocked={() => setLocalUnlocked(true)}
          onSignOut={signOut}
        />
      );
    }
    if (mustChangePassword) return <ChangePasswordScreen />;
    if (onboarded === null) return <Splash />;
    if (!onboarded) {
      return <OnboardingPermissionsScreen onComplete={() => setOnboarded(true)} />;
    }
    if (deviceOk === null) return <Splash />;
    if (!deviceOk) {
      return (
        <DeviceGateScreen
          deviceInfo={deviceInfo}
          onApproved={() => setDeviceOk(true)}
        />
      );
    }
    if (ohaabOk === null) return <Splash />;
    if (!ohaabOk) {
      return <OhaabGateScreen onComplete={() => setOhaabOk(true)} />;
    }
  }
  return (
    <>
      <OfflineSyncBanner />
      <LocationTracker />
      <SiteVisitVerifier />
      <CallHost />
      <IncomingLiveInviteManager />
      <PushNotificationManager />
      <ActivityLogger />
      <ScreenLiveShare viewRef={shareRef} />
      <AppStack />
      <ForceUpdateModal />
    </>
  );
}

function ThemedRoot({ shareRef }) {
  const { colors, isDark } = useTheme();
  return (
    <NavigationContainer ref={navigationRef} theme={buildNavTheme(colors, isDark)} onReady={flushPendingNotification}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineGate>
        <Root shareRef={shareRef} />
      </OfflineGate>
    </NavigationContainer>
  );
}

export default function App() {
  const shareRef = useRef(null);

  useEffect(() => {
    // Утасны чадлыг эхлэхэд нэг удаа тогтооно — видео дуудлагын нягтрал,
    // жагсаалтын ачаалал зэрэг нь үүнээс хамаарна (src/lib/performanceMode.js).
    initPerformanceMode().catch(() => {});
    loadFeatureFlagOverrides()
      .then(() => {
        installGlobalCrashHandlers();
        startOfflineSyncWatcher();
      })
      .catch(() => {
        installGlobalCrashHandlers();
        startOfflineSyncWatcher();
      });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <FaceDetectionProvider
              options={{
                performanceMode: 'accurate',
                landmarkMode: true,
                classificationMode: true,
                contourMode: false,
                minFaceSize: 0.2,
                isTrackingEnabled: false,
              }}
            >
              <AppProvider>
                {/* Дуудлага нь дэлгэцээс дээгүүр амьдардаг тул AppProvider-ын
                    дотор, навигацийн ГАДНА байрлана. */}
                <CallProvider>
                  <View ref={shareRef} style={{ flex: 1 }} collapsable={false}>
                    <ThemedRoot shareRef={shareRef} />
                  </View>
                </CallProvider>
              </AppProvider>
            </FaceDetectionProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
