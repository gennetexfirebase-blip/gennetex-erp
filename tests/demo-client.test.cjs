const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/load-app-module.cjs');

function setup() {
  const load = createLoader({
    'expo-file-system/legacy': {},
    'base64-arraybuffer': {},
    './notificationService': { notifyChatMembers: async () => {} },
  });
  const client = load('src/lib/demoClient.js').demoClient;
  return { client, load };
}

test('insert/update/single support real screen save paths', async () => {
  const { client } = setup();
  const created = await client.from('inventory').insert({ name: 'Test material', quantity: 10 }).select().single();
  assert.equal(created.error, null);
  assert.equal(created.data.name, 'Test material');
  const updated = await client.from('inventory').update({ quantity: 7 }).eq('id', created.data.id).select().single();
  assert.equal(updated.data.quantity, 7);
  assert.equal((await client.from('inventory').select().eq('id', created.data.id).single()).data.quantity, 7);
});

test('upsert replaces matching rows instead of duplicating settings', async () => {
  const { client } = setup();
  await client.from('notification_settings').upsert({ user_id: 'demo', enabled: true }, { onConflict: 'user_id' });
  await client.from('notification_settings').upsert({ user_id: 'demo', enabled: false }, { onConflict: 'user_id' });
  const result = await client.from('notification_settings').select().eq('user_id', 'demo').single();
  assert.equal(result.error, null);
  assert.equal(result.data.enabled, false);
  assert.equal((await client.from('notification_settings').select()).data.length, 1);
});

test('attendance OR neq filters preserve approved active sessions', async () => {
  const { client } = setup();
  await client.from('test_attendance').insert([{ id: 'a', status: 'approved' }, { id: 'b', status: 'rejected' }, { id: 'c', status: null }]);
  const result = await client.from('test_attendance').select().or('status.neq.rejected,status.is.null');
  assert.deepEqual(Array.from(result.data, r => r.id), ['a', 'c']);
});

test('not and search filters return relevant demo rows', async () => {
  const { client } = setup();
  await client.from('test_search').insert([
    { id: 'a', content: 'Network cable', status: 'open', attachment_url: 'demo:image' },
    { id: 'b', content: 'Closed job', status: 'closed', attachment_url: null },
  ]);
  assert.equal((await client.from('test_search').select().or('content.ilike.%network%,content.ilike.%missing%')).data.length, 1);
  assert.equal((await client.from('test_search').select().not('attachment_url', 'is', null)).data.length, 1);
  assert.equal((await client.from('test_search').select().not('status', 'in', '("closed","rejected")')).data.length, 1);
});

test('head/count counts all matches before pagination', async () => {
  const { client } = setup();
  await client.from('test_count').insert([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const result = await client.from('test_count').select('*', { count: 'exact', head: true }).limit(1);
  assert.equal(result.data, null);
  assert.equal(result.count, 3);
});

test('awaiting one mutation twice does not insert twice', async () => {
  const { client } = setup();
  const query = client.from('test_repeat').insert({ id: 'once' });
  await query;
  await query;
  assert.equal((await client.from('test_repeat').select()).data.length, 1);
});

test('single/maybeSingle report cardinality errors instead of choosing an arbitrary row', async () => {
  const { client } = setup();
  assert.equal((await client.from('test_empty').select().maybeSingle()).data, null);
  assert.equal((await client.from('test_empty').select().single()).error.code, 'PGRST116');
  await client.from('test_empty').insert([{ id: 'a' }, { id: 'b' }]);
  assert.equal((await client.from('test_empty').select().maybeSingle()).error.code, 'PGRST116');
});

test('demo profile edits survive profile reload', async () => {
  const { client } = setup();
  const initial = await client.rpc('claim_authorized_profile');
  await client.from('profiles').update({ name: 'Edited demo name' }).eq('id', initial.data.id);
  assert.equal((await client.rpc('claim_authorized_profile')).data.name, 'Edited demo name');
});

test('demo fixtures cover actual inventory and vehicle schema', async () => {
  const { client } = setup();
  const inventory = (await client.from('inventory').select()).data;
  assert.ok(inventory.length > 0);
  assert.ok(inventory.every(row => ['material', 'tool', 'supply'].includes(row.category)));
  const vehicles = (await client.from('vehicles').select()).data;
  assert.ok(vehicles.every(row => row.plate_number && Number.isFinite(row.fuel_level_percent)));
});

test('employee RPC exposes registered UUID identities used by assignments', async () => {
  const { client, load } = setup();
  const { employeeRef } = load('src/lib/pendingRef.js');
  const result = await client.rpc('admin_list_authorized_users');
  assert.ok(result.data.length > 0);
  for (const row of result.data) {
    assert.equal(row.registered, true);
    assert.equal(employeeRef({ ...row, id: row.record_id }).id, row.record_id);
  }
});

test('inventory service can load, create, edit and delete demo items', async () => {
  const { client } = setup();
  const load = createLoader({
    'react-native': { Platform: { OS: 'android' } },
    '../lib/supabase': { supabase: client },
    'expo-file-system/legacy': {},
    'base64-arraybuffer': {},
  });
  const service = load('src/services/inventoryService.js');
  const boxes = load('src/services/boxService.js');
  assert.ok(Array.isArray(await boxes.fetchBoxes()), 'InventoryScreen requires a box list, never null');
  assert.ok((await service.fetchInventory()).length > 0);
  const item = await service.insertInventory({ name: 'Demo test', unit: 'pcs', quantity: 3, price: 50 });
  assert.equal(item.name, 'Demo test');
  assert.equal((await service.updateInventory(item.id, { quantity: 2 })).quantity, 2);
  await service.deleteInventory(item.id);
  assert.equal((await service.fetchInventory()).some(row => row.id === item.id), false);
});

test('demo employee changes persist and pending employees can be revoked', async () => {
  const { client } = setup();
  const before = (await client.rpc('admin_list_authorized_users')).data;
  const id = before[1].record_id;
  await client.rpc('admin_set_user_department', { target_id: id, p_department_id: 'dm-dep-4' });
  await client.rpc('admin_set_employment', { p_email: before[1].email, p_active: false });
  const updated = (await client.rpc('admin_list_authorized_users')).data.find(row => row.record_id === id);
  assert.equal(updated.department_id, 'dm-dep-4');
  assert.equal(updated.active, false);
  await client.rpc('admin_authorize_gmail', { p_email: 'pending@example.com', p_name: 'New demo', p_role: 'employee' });
  const pending = (await client.rpc('admin_list_authorized_users')).data.find(row => row.email === 'pending@example.com');
  assert.equal(pending.registered, false);
  assert.equal(pending.record_id, 'pending:pending@example.com');
  await client.rpc('admin_revoke_authorization', { p_email: pending.email });
  assert.equal((await client.rpc('admin_list_authorized_users')).data.length, before.length);
  await client.rpc('admin_delete_user', { target_id: id });
  assert.equal((await client.rpc('admin_list_authorized_users')).data.some(row => row.record_id === id), false);
});

test('chat service sends and edits messages inside demo data', async () => {
  const { client } = setup();
  const load = createLoader({
    'react-native': { Platform: { OS: 'android' } },
    '../lib/supabase': { supabase: client },
    './supabase': { supabase: client },
    'expo-file-system/legacy': {}, 'base64-arraybuffer': {},
    './notificationService': { notifyChatMembers: async () => {} },
  });
  const service = load('src/services/chatService.js');
  const updates = [];
  const unsubscribe = service.subscribeMessages('general', row => updates.push(row));
  const user = (await client.auth.getUser()).data.user;
  const sent = await service.sendMessage({ senderId: user.id, senderName: 'Demo', content: 'Test message' });
  assert.equal(sent.content, 'Test message');
  assert.equal(updates[0].id, sent.id);
  unsubscribe();
  await service.updateMessage(sent.id, user.id, 'Edited message');
  assert.equal((await service.fetchMessages()).find(row => row.id === sent.id).content, 'Edited message');
});

test('vehicle crew: demo user joins the seeded driver, max 2, one vehicle per day', async () => {
  const { client, load } = setup();
  load('src/lib/demoClient.js').resetDemoOverlay();
  const before = (await client.rpc('vehicle_crews_today')).data;
  assert.equal(before.length, 1);
  assert.equal(before[0].members.length, 1);
  const seeded = before[0].vehicle_id;

  const joined = await client.rpc('join_vehicle_today', { p_vehicle_id: seeded });
  assert.equal(joined.error, null);
  assert.equal(joined.data.role, 'passenger');
  const after = (await client.rpc('vehicle_crews_today')).data.find(c => c.vehicle_id === seeded);
  assert.equal(after.members.length, 2);

  const again = await client.rpc('join_vehicle_today', { p_vehicle_id: seeded });
  assert.equal(again.data.already, true);

  const vehicles = (await client.from('vehicles').select()).data;
  const other = vehicles.find(v => v.id !== seeded);
  if (other) {
    const blocked = await client.rpc('join_vehicle_today', { p_vehicle_id: other.id });
    assert.match(blocked.error.message, /already_in_other/);
  }
});
