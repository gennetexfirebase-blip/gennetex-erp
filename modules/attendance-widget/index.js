import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Android-ийн ирцийн widget (AppWidget) — апп ↔ widget өгөгдөл.
 * iOS дээр `@bacons/apple-targets`-ийн ExtensionStorage ашиглана
 * (src/services/attendanceWidgetService.js).
 */
const Native = requireOptionalNativeModule('AttendanceWidget');

export const isAvailable = () => !!Native;
export const setItem = (key, value) => Native?.setItem(key, String(value));
export const removeItem = (key) => Native?.removeItem(key);
export const reloadWidgets = () => Native?.reloadWidgets();
