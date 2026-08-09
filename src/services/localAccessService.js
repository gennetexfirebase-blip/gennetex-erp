import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

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
