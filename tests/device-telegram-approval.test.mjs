import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedDeviceApprover, parseDeviceDecision } from '../supabase/functions/_shared/deviceApproval.ts';

const id = '6122de9b-b3b5-42f6-b623-ac097ed25dbd';

test('Telegram device callbacks accept only a valid decision and UUID', () => {
  assert.deepEqual(parseDeviceDecision(`device:approve:${id}`), { status: 'approved', requestId: id });
  assert.deepEqual(parseDeviceDecision(`device:reject:${id}`), { status: 'rejected', requestId: id });
  assert.equal(parseDeviceDecision('device:approve:1'), null);
  assert.equal(parseDeviceDecision(`device:delete:${id}`), null);
});

test('only a linked superadmin or configured private admin can approve', () => {
  const base = { chatId: 123456, chatType: 'private', fromId: 123456, configuredAdminChatId: '', profileRole: 'employee', profileTelegramUserId: 123456 };
  assert.equal(isAuthorizedDeviceApprover(base), false);
  assert.equal(isAuthorizedDeviceApprover({ ...base, profileRole: 'superadmin' }), true);
  assert.equal(isAuthorizedDeviceApprover({ ...base, profileTelegramUserId: 999, profileRole: 'superadmin' }), false);
  assert.equal(isAuthorizedDeviceApprover({ ...base, configuredAdminChatId: '123456' }), true);
  assert.equal(isAuthorizedDeviceApprover({ ...base, chatType: 'group', configuredAdminChatId: '123456' }), false);
  assert.equal(isAuthorizedDeviceApprover({ ...base, fromId: 654321, configuredAdminChatId: '123456' }), false);
  assert.equal(isAuthorizedDeviceApprover({ ...base, configuredAdminChatId: '-123456' }), false);
});
