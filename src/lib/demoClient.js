/**
 * Demo горимын Supabase-ийн ОРЛУУЛАГЧ.
 *
 * ЯАГААД ЭНЭ АРГА ВЭ:
 *   Апп 87 дэлгэцтэй бөгөөд бараг бүгд `supabase.from(...)` дууддаг.
 *   Дэлгэц тус бүрд "demo эсэх" шалгалт нэмэх нь 87 газар засвар
 *   шаардах бөгөөд нэгийг нь мартвал тэр дэлгэц БОДИТ өгөгдөл
 *   харуулна — яг тэр нь болохгүй зүйл.
 *
 *   Тиймээс нэг цэгээс таслав: demo идэвхтэй үед `supabase` объект
 *   өөрөө орлуулагчаар солигдоно. Сүлжээний дуудлага ОГТ гарахгүй тул
 *   бодит өгөгдөл алдагдах боломж байхгүй.
 *
 * ХАМРАХ ХҮРЭЭ:
 *   PostgREST-ийн түгээмэл гинжийг дуурайна — select/eq/in/order/
 *   limit/single/insert/update/delete. Бүх боломжийг биш, апп
 *   ашигладгийг нь.
 *
 * ⚠️ Энэ файл нь ЗӨВХӨН demo дансанд ажиллана. Бодит хэрэглэгчид
 *    жинхэнэ `supabase` клиент рүү ордог.
 */
import { demoTable, DEMO_USER } from './demoData';

/**
 * Demo сесс дэх өөрчлөлтүүд.
 *
 * Шинжээч "ажилтан нэмэх" зэрэг үйлдэл хийж үзэхэд ажиллах ёстой —
 * товч дарахад юу ч болохгүй бол "апп эвдэрсэн" гэж дүгнэнэ. Тиймээс
 * нэмсэн мөрийг санах ойд хадгалж, тэр сессийн турш харуулна.
 *
 * Аппыг хаахад арилна — demo өгөгдөл хуримтлагдах шаардлагагүй.
 */
const overlay = new Map(); // table -> { added: [], updated: Map, deleted: Set }
const subscriptions = new Set();

function emitChange(table, eventType, next, previous = {}) {
  for (const channel of subscriptions) {
    for (const { type, filter, callback } of channel.handlers) {
      if (type !== 'postgres_changes' || filter.table !== table || !['*', eventType].includes(filter.event)) continue;
      const condition = filter.filter?.match(/^([^=]+)=([^.]+)\.(.*)$/);
      if (condition && !matches(eventType === 'DELETE' ? previous : next, condition[1], condition[2], condition[3])) continue;
      try { callback({ eventType, new: next, old: previous, schema: 'public', table }); } catch (error) { console.warn('Demo subscription:', error.message); }
    }
  }
}

function bucket(table) {
  if (!overlay.has(table)) {
    overlay.set(table, { added: [], updated: new Map(), deleted: new Set() });
  }
  return overlay.get(table);
}

export function resetDemoOverlay() {
  overlay.clear();
}

function rowsFor(table) {
  const b = bucket(table);
  const base = demoTable(table).concat(b.added);
  return base
    .filter((r) => !b.deleted.has(r.id))
    .map((r) => (b.updated.has(r.id) ? { ...r, ...b.updated.get(r.id) } : r));
}

let seq = 0;
const newId = (t) => `dm-${t}-new-${++seq}`;

/** `a.b` гүн утга уншина — `order('profiles.name')` мэтэд хэрэгтэй. */
function get(row, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), row);
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matches(row, column, operator, value) {
  const actual = get(row, column);
  switch (operator) {
    case 'eq': return actual != null && String(actual) === String(value);
    case 'neq': return actual != null && String(actual) !== String(value);
    case 'is': return value === null || value === 'null' ? actual == null : String(actual) === String(value);
    case 'gt': return actual > value;
    case 'gte': return actual >= value;
    case 'lt': return actual < value;
    case 'lte': return actual <= value;
    case 'in': {
      const values = Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, '').split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return actual != null && values.map(String).includes(String(actual));
    }
    case 'like':
    case 'ilike': {
      const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
      return new RegExp(`^${pattern}$`, operator === 'ilike' ? 'i' : '').test(String(actual ?? ''));
    }
    default: throw new Error(`Demo filter is not supported: ${operator}`);
  }
}

function splitFilters(expression) {
  const parts = [];
  let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '"') quoted = !quoted;
    if (quoted) continue;
    if (expression[i] === '(') depth++;
    if (expression[i] === ')') depth--;
    if (expression[i] === ',' && depth === 0) { parts.push(expression.slice(start, i)); start = i + 1; }
  }
  return [...parts, expression.slice(start)];
}

class DemoQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sorts = [];
    this.limitN = null;
    this.mode = 'select';
    this.payload = null;
    this.isSingle = false;
    this.maybe = false;
  }

  // ── Фильтрүүд ───────────────────────────────────────────────────
  eq(c, v) { this.filters.push((r) => String(get(r, c)) === String(v)); return this; }
  neq(c, v) { this.filters.push((r) => String(get(r, c)) !== String(v)); return this; }
  gt(c, v) { this.filters.push((r) => get(r, c) > v); return this; }
  gte(c, v) { this.filters.push((r) => get(r, c) >= v); return this; }
  lt(c, v) { this.filters.push((r) => get(r, c) < v); return this; }
  lte(c, v) { this.filters.push((r) => get(r, c) <= v); return this; }
  in(c, arr) {
    const s = new Set((arr || []).map(String));
    this.filters.push((r) => s.has(String(get(r, c))));
    return this;
  }
  is(c, v) {
    this.filters.push((r) => (v === null ? get(r, c) == null : get(r, c) === v));
    return this;
  }
  like(c, pat) { return this.ilike(c, pat); }
  ilike(c, pat) {
    const rx = new RegExp('^' + String(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
    this.filters.push((r) => rx.test(String(get(r, c) ?? '')));
    return this;
  }
  contains(column, value) {
    this.filters.push(row => {
      const actual = get(row, column);
      return Array.isArray(value)
        ? Array.isArray(actual) && value.every(v => actual.includes(v))
        : actual != null && Object.entries(value).every(([key, v]) => actual[key] === v);
    });
    return this;
  }
  not(column, operator, value) {
    this.filters.push(row => (operator === 'is' || get(row, column) != null) && !matches(row, column, operator, value));
    return this;
  }
  or(expr) {
    const parts = splitFilters(String(expr)).map(s => s.trim());
    this.filters.push((r) =>
      parts.some((p) => {
        const match = p.match(/^([^.]+)\.([^.]+)\.(.*)$/);
        return match ? matches(r, match[1], match[2], match[3]) : false;
      })
    );
    return this;
  }

  // ── Эрэмбэ, хязгаар ─────────────────────────────────────────────
  order(col, opts = {}) {
    this.sorts.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n) { this.limitN = n; return this; }
  range(a, b) { this.rangeFrom = a; this.limitN = b - a + 1; return this; }

  // ── Үйлдлүүд ────────────────────────────────────────────────────
  select(_columns = '*', options = {}) { this.head = !!options.head; this.countRequested = !!options.count; return this; }
  insert(v) { this.mode = 'insert'; this.payload = v; return this; }
  upsert(v, options = {}) { this.mode = 'upsert'; this.payload = v; this.conflictColumns = (options.onConflict || 'id').split(',').map(c => c.trim()); this.ignoreDuplicates = !!options.ignoreDuplicates; return this; }
  update(v) { this.mode = 'update'; this.payload = v; return this; }
  delete() { this.mode = 'delete'; return this; }

  maybeSingle() { this.maybe = true; this.isSingle = true; return this; }
  single() { this.isSingle = true; return this; }

  result(rows, count = rows.length) {
    if (this.isSingle && (rows.length > 1 || (!rows.length && !this.maybe))) {
      return { data: null, error: { message: 'Expected a single row', code: 'PGRST116' } };
    }
    return { data: this.head ? null : this.isSingle ? rows[0] || null : rows, error: null, count };
  }

  // ── Гүйцэтгэл ───────────────────────────────────────────────────
  run() {
    const b = bucket(this.table);

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      const made = arr.map(x => {
        const existing = this.mode === 'upsert' && rowsFor(this.table).find(row => this.conflictColumns.every(c => x[c] != null && String(row[c]) === String(x[c])));
        if (existing) {
          if (this.ignoreDuplicates) return existing;
          b.updated.set(existing.id, { ...(b.updated.get(existing.id) || {}), ...x, id: existing.id });
          emitChange(this.table, 'UPDATE', { ...existing, ...x, id: existing.id }, existing);
          return { ...existing, ...x, id: existing.id };
        }
        const row = { ...x, id: x.id ?? newId(this.table), created_at: x.created_at || new Date().toISOString() };
        b.added.push(row);
        emitChange(this.table, 'INSERT', row);
        return row;
      });
      return this.result(made);
    }

    let rows = rowsFor(this.table).filter((r) => this.filters.every((f) => f(r)));

    if (this.mode === 'update') {
      rows.forEach((r) => b.updated.set(r.id, { ...(b.updated.get(r.id) || {}), ...this.payload }));
      const out = rows.map((r) => ({ ...r, ...this.payload }));
      out.forEach((row, index) => emitChange(this.table, 'UPDATE', row, rows[index]));
      return this.result(out);
    }

    if (this.mode === 'delete') {
      rows.forEach((r) => b.deleted.add(r.id));
      rows.forEach(row => emitChange(this.table, 'DELETE', {}, row));
      return { data: null, error: null };
    }

    for (const s of [...this.sorts].reverse()) {
      rows = rows.sort((x, y) => (s.asc ? cmp(get(x, s.col), get(y, s.col)) : cmp(get(y, s.col), get(x, s.col))));
    }
    const count = rows.length;
    if (this.rangeFrom) rows = rows.slice(this.rangeFrom);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);

    return this.result(rows, count);
  }

  then(res, rej) {
    if (!this.execution) this.execution = Promise.resolve().then(() => this.run()).catch(error => ({ data: null, error }));
    return this.execution.then(res, rej);
  }
  catch(reject) { return this.then(undefined, reject); }
  finally(callback) { return this.then().finally(callback); }
}

/**
 * Demo клиент — жинхэнэ `supabase`-ийн оронд.
 *
 * ⚠️ `auth` нь demo хэрэглэгчийг буцаана. Хэрэв энд `null` буцаавал
 *    апп нэвтрээгүй гэж үзээд login дэлгэц рүү буцаана.
 */
export const demoClient = {
  __demo: true,

  from(table) { return new DemoQuery(table); },

  /** Demo mutations stay in the session overlay. */
  rpc(name, args = {}) {
    if (name === 'box_list') {
      return Promise.resolve({ data: rowsFor('boxes'), error: null });
    }
    // ⚠️ `claim_authorized_profile` нь нэвтэрсний дараа профайлыг
    //    буцаадаг гол дуудлага. `null` буцаавал AppContext нь
    //    `authProfile = null` тавьж, апп нэвтрээгүй гэж үзээд login
    //    дэлгэц рүү шидэх тул demo данс ХЭЗЭЭ Ч орж чадахгүй болно.
    if (name === 'claim_authorized_profile') {
      return Promise.resolve({ data: rowsFor('profiles').find(row => row.id === DEMO_USER.id) || null, error: null });
    }
    if (name === 'admin_list_authorized_users') {
      const data = rowsFor('authorized_users').map(row => {
        const profile = rowsFor('profiles').find(item => item.id === row.linked_user_id);
        return { ...row, ...profile, record_id: profile?.id || `pending:${row.email}`, registered: !!profile };
      });
      return Promise.resolve({ data, error: null });
    }
    if (name === 'admin_authorize_gmail') {
      return new DemoQuery('authorized_users').upsert({
        email: args.p_email.trim().toLowerCase(), name: args.p_name,
        last_name: args.p_last_name, position: args.p_position, phone: args.p_phone,
        address: args.p_address, role: args.p_role, active: true,
        department_id: args.p_department_id || DEMO_USER.department_id,
      }, { onConflict: 'email' }).select().single();
    }
    if (name === 'admin_revoke_authorization') {
      return new DemoQuery('authorized_users').delete().eq('email', args.p_email);
    }
    if (name === 'admin_delete_user') {
      return Promise.all([
        new DemoQuery('profiles').delete().eq('id', args.target_id),
        new DemoQuery('authorized_users').delete().eq('linked_user_id', args.target_id),
      ]).then(() => ({ data: true, error: null }));
    }
    const patches = {
      admin_set_user_department: { department_id: args.p_department_id },
      admin_set_user_role: { role: args.new_role },
      admin_set_user_permissions: { permissions: args.p_permissions },
      admin_set_employment: { active: args.p_active },
    };
    if (patches[name]) {
      const byEmail = name === 'admin_set_employment';
      return Promise.all([
        new DemoQuery('profiles').update(patches[name]).eq(byEmail ? 'email' : 'id', byEmail ? args.p_email : args.target_id),
        new DemoQuery('authorized_users').update(patches[name]).eq(byEmail ? 'email' : 'linked_user_id', byEmail ? args.p_email : args.target_id),
      ]).then(([result]) => result);
    }
    // Бусад RPC — амжилттай гэж хариулна. Шинжээч товч дарахад
    // алдаа гарахгүй байх нь чухал.
    return Promise.resolve({ data: null, error: null });
  },

  auth: {
    async getUser() { return { data: { user: { id: DEMO_USER.id, email: DEMO_USER.email } }, error: null }; },
    async getSession() {
      return { data: { session: { user: { id: DEMO_USER.id, email: DEMO_USER.email } } }, error: null };
    },
    async signOut() { resetDemoOverlay(); return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword() { return { data: { user: { id: DEMO_USER.id } }, error: null }; },
  },

  /** Update subscribed screens immediately without a network connection. */
  channel() {
    const ch = {
      handlers: [],
      on(type, filter, callback) { ch.handlers.push({ type, filter, callback }); return ch; },
      subscribe(callback) { subscriptions.add(ch); callback?.('SUBSCRIBED'); return ch; },
      unsubscribe() { subscriptions.delete(ch); },
    };
    return ch;
  },
  removeChannel(channel) { channel?.unsubscribe(); },

  storage: {
    from() {
      return {
        async upload() { return { data: { path: 'demo/placeholder.jpg' }, error: null }; },
        getPublicUrl() { return { data: { publicUrl: '' } }; },
        async remove() { return { data: null, error: null }; },
        async createSignedUrl() { return { data: { signedUrl: '' }, error: null }; },
      };
    },
  },

  functions: {
    async invoke() { return { data: null, error: null }; },
  },
};
