export type DeviceDecision = { status: 'approved' | 'rejected'; requestId: string };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CALLBACK = new RegExp(`^device:(approve|reject):(${UUID})$`, 'i');

export function parseDeviceDecision(value: unknown): DeviceDecision | null {
  const match = typeof value === 'string' ? value.match(CALLBACK) : null;
  if (!match) return null;
  return { status: match[1].toLowerCase() === 'approve' ? 'approved' : 'rejected', requestId: match[2].toLowerCase() };
}

export function isAuthorizedDeviceApprover({
  chatId,
  chatType,
  fromId,
  configuredAdminChatId,
  profileRole,
  profileTelegramUserId,
}: {
  chatId: unknown;
  chatType: unknown;
  fromId: unknown;
  configuredAdminChatId: unknown;
  profileRole: unknown;
  profileTelegramUserId: unknown;
}): boolean {
  if (chatType !== 'private' || !Number.isSafeInteger(Number(fromId))) return false;
  if (String(chatId) !== String(fromId)) return false;
  const linkedSuperAdmin = profileRole === 'superadmin' &&
    String(profileTelegramUserId || '') === String(fromId);
  const configuredPrivateAdmin = /^[1-9][0-9]*$/.test(String(configuredAdminChatId || '')) &&
    String(configuredAdminChatId) === String(fromId);
  return linkedSuperAdmin || configuredPrivateAdmin;
}
