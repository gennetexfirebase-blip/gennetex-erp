import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { useApp } from '../context/AppContext';
import { navigateFromNotification } from '../lib/navigationRef';
import { refreshAttendanceWidget, syncAttendanceWidget } from '../services/attendanceWidgetService';

/**
 * Нүүр дэлгэцийн ирцийн widget-ийг аппын төлөвтэй холбоно.
 *
 * - Нэвтэрмэгц widget-д token + өнөөдрийн төлөв өгнө.
 * - Апп идэвхжих бүрд төлөвийг шинэчилнэ (өөр замаар бүртгэсэн байж болно).
 * - Widget-ийг дарахад (`gennetex-erp://attendance`) Ирц таб нээгдэнэ —
 *   бүсээс гадуур үед widget хэрэглэгчийг энд илгээдэг.
 *
 * Төхөөрөмж зөвшөөрөгдсөний ДАРАА л render хийгддэг (App.js) тул token
 * зөвхөн баталгаажсан төхөөрөмжид олгогдоно.
 */
export default function AttendanceWidgetSync() {
  const { currentUser, isCloud } = useApp();
  const userId = currentUser?.id;

  useEffect(() => {
    if (!isCloud || !userId) return;
    syncAttendanceWidget(userId).catch(() => {});
  }, [isCloud, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAttendanceWidget().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const open = (url) => {
      if (url && /:\/\/attendance\b/.test(url)) navigateFromNotification({ screen: 'Attendance' });
    };
    Linking.getInitialURL().then(open).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => open(e.url));
    return () => sub.remove();
  }, []);

  return null;
}
