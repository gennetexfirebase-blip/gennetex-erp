/**
 * Multi-branch / multi-warehouse foundation.
 */
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFlagOn } from '../lib/featureFlags';

const ACTIVE_KEY = '@gennetex/active_branch_v1';

export const DEFAULT_BRANCHES = [
  {
    id: 'main',
    name: 'Төв салбар',
    code: 'UB-MAIN',
    city: 'Улаанбаатар',
    warehouse_name: 'Төв агуулах',
    is_default: true,
  },
];

export async function fetchBranches() {
  if (!isFlagOn('multiBranch')) return DEFAULT_BRANCHES;
  if (!supabase) return DEFAULT_BRANCHES;
  try {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error || !data?.length) return DEFAULT_BRANCHES;
    return data;
  } catch {
    return DEFAULT_BRANCHES;
  }
}

export async function getActiveBranchId() {
  try {
    return (await AsyncStorage.getItem(ACTIVE_KEY)) || 'main';
  } catch {
    return 'main';
  }
}

export async function setActiveBranchId(id) {
  await AsyncStorage.setItem(ACTIVE_KEY, id || 'main');
  return id;
}

export async function getActiveBranch() {
  const id = await getActiveBranchId();
  const list = await fetchBranches();
  return list.find((b) => b.id === id) || list[0] || DEFAULT_BRANCHES[0];
}

export async function createBranch(payload) {
  if (!supabase) throw new Error('Cloud required');
  const row = {
    name: payload.name,
    code: payload.code || null,
    city: payload.city || null,
    warehouse_name: payload.warehouse_name || null,
    address: payload.address || null,
    is_default: !!payload.is_default,
  };
  const { data, error } = await supabase.from('branches').insert(row).select().single();
  if (error) throw error;
  return data;
}
