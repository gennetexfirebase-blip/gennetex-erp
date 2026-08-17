import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const KEY_PREFIX = 'gennetex.local-access.v1.';

function keyFor(userId) {
  return `${KEY_PREFIX}${userId}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}:gennetex-local-unlock`
  );
}

export async function getBiometricCapability() {
  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { available: hasHardware && enrolled, hasHardware, enrolled, types };
}

export async function getLocalAccessConfig(userId) {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setupLocalAccess(userId, pin, enableBiometric) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN 4 оронтой тоо байна.');

  let biometricEnabled = false;
  if (enableBiometric) {
    const capability = await getBiometricCapability();
    if (!capability.available) throw new Error('Энэ утсанд биометр бүртгэгдээгүй байна.');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Биометр нэвтрэлтийг идэвхжүүлэх',
      cancelLabel: 'Болих',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    if (!result.success) throw new Error('Биометр баталгаажуулалт цуцлагдлаа.');
    biometricEnabled = true;
  }

  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const pinHash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(
    keyFor(userId),
    JSON.stringify({ version: 1, salt, pinHash, biometricEnabled })
  );
  // Хөгжүүлэгчийн хяналтад ТӨЛӨВийг мэдэгдэнэ (PIN өөрөө явахгүй).
  await reportPinState(true);
  return { biometricEnabled };
}

export async function verifyLocalPin(userId, pin) {
  const config = await getLocalAccessConfig(userId);
  if (!config || !/^\d{4}$/.test(pin)) return false;
  return (await hashPin(pin, config.salt)) === config.pinHash;
}

export async function unlockWithBiometric(userId) {
  const config = await getLocalAccessConfig(userId);
  if (!config?.biometricEnabled) return { success: false, reason: 'not_enabled' };
  const capability = await getBiometricCapability();
  if (!capability.available) return { success: false, reason: 'not_available' };
  return LocalAuthentication.authenticateAsync({
    promptMessage: 'Gennetex ERP нээх',
    cancelLabel: 'PIN ашиглах',
    fallbackLabel: 'PIN ашиглах',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  });
}

export async function clearLocalAccess(userId) {
  if (!userId) return;
  await SecureStore.deleteItemAsync(keyFor(userId));
}

// ---------------------------------------------------------------------------
// Хөгжүүлэгчийн хяналт
// ---------------------------------------------------------------------------
//
// ⚠️ PIN болон түүний hash нь ЗӨВХӨН төхөөрөмж дээр үлдэнэ. Сервер рүү
//    зөвхөн ТӨЛӨВ ("PIN тохируулсан эсэх", "хэзээ") явна. Ингэснээр
//    хөгжүүлэгч хэн PIN-гүй яваа, хэн мартсаныг хараад арга хэмжээ авна,
//    гэхдээ хэн нэгний PIN-ийг уншиж, оронд нь нэвтэрч чадахгүй.

/** "Би PIN тохируулсан / устгасан" гэдгээ серверт мэдэгдэнэ. */
export async function reportPinState(hasPin) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('set_my_pin_state', { p_has_pin: !!hasPin });
  } catch {
    // Сүлжээгүй байж болно — түгжээ нээх урсгалыг зогсоохгүй.
  }
}

/**
 * Хөгжүүлэгч надаас PIN-ээ дахин тохируулахыг шаардсан эсэх.
 *
 * Сүлжээгүй үед `null` буцаана — тэр үед хуучин PIN хэвээр ажиллана
 * (офлайн ажилтныг апп-аасаа таслахгүй).
 */
export async function fetchPinPolicy() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('my_pin_policy');
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/** Хөгжүүлэгч: тухайн хүнээс PIN-ээ дахин тохируулахыг шаардана. */
export async function requirePinReset(userId, required = true) {
  const { data, error } = await supabase.rpc('admin_require_pin_reset', {
    target_id: userId,
    p_required: required,
  });
  if (error) {
    if (/forbidden/.test(error.message)) throw new Error('Зөвхөн Хөгжүүлэгч энэ үйлдлийг хийнэ.');
    if (/target_not_found/.test(error.message)) throw new Error('Хэрэглэгч олдсонгүй.');
    throw error;
  }
  return data;
}
