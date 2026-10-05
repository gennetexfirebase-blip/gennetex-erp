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

class DemoQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sorts = [];
    this.limitN = null;
    this.mode = 'select';
    this.payload = null;
    this.single = false;
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
  contains() { return this; }
  not() { return this; }
  /** `or('a.eq.1,b.eq.2')` — энгийн eq-үүдийг л дэмжинэ. */
  or(expr) {
    const parts = String(expr).split(',').map((s) => s.trim());
    this.filters.push((r) =>
      parts.some((p) => {
        const [col, op, val] = p.split('.');
        if (op === 'eq') return String(get(r, col)) === String(val);
        if (op === 'is') return val === 'null' ? get(r, col) == null : true;
        return false;
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
  select() { if (this.mode === 'select') this.mode = 'select'; return this; }
  insert(v) { this.mode = 'insert'; this.payload = v; return this; }
  upsert(v) { this.mode = 'insert'; this.payload = v; return this; }
  update(v) { this.mode = 'update'; this.payload = v; return this; }
  delete() { this.mode = 'delete'; return this; }

  maybeSingle() { this.maybe = true; this.single = true; return this; }
  single() { this.single = true; return this; }

  // ── Гүйцэтгэл ───────────────────────────────────────────────────
  run() {
    const b = bucket(this.table);

    if (this.mode === 'insert') {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      const made = arr.map((x) => ({
        id: x.id || newId(this.table),
        created_at: new Date().toISOString(),
        ...x,
      }));
      b.added.push(...made);
      return { data: this.single ? made[0] : made, error: null };
    }

    let rows = rowsFor(this.table).filter((r) => this.filters.every((f) => f(r)));

    if (this.mode === 'update') {
      rows.forEach((r) => b.updated.set(r.id, { ...(b.updated.get(r.id) || {}), ...this.payload }));
      const out = rows.map((r) => ({ ...r, ...this.payload }));
      return { data: this.single ? out[0] || null : out, error: null };
    }

    if (this.mode === 'delete') {
      rows.forEach((r) => b.deleted.add(r.id));
      return { data: null, error: null };
    }

    for (const s of [...this.sorts].reverse()) {
      rows = rows.sort((x, y) => (s.asc ? cmp(get(x, s.col), get(y, s.col)) : cmp(get(y, s.col), get(x, s.col))));
    }
    if (this.rangeFrom) rows = rows.slice(this.rangeFrom);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);

    if (this.single) {
      if (!rows.length && !this.maybe) {
        return { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      }
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null, count: rows.length };
  }

  then(res, rej) {
    try { return Promise.resolve(this.run()).then(res, rej); }
    catch (e) { return Promise.resolve({ data: null, error: e }).then(res, rej); }
  }
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

  /**
   * RPC — demo-д ихэнх нь зүгээр л амжилттай гэж хариулна.
   * Шинжээч товч дарахад алдаа гарахгүй байх нь чухал.
   */
  rpc(name) {
    // ⚠️ `claim_authorized_profile` нь нэвтэрсний дараа профайлыг
    //    буцаадаг гол дуудлага. `null` буцаавал AppContext нь
    //    `authProfile = null` тавьж, апп нэвтрээгүй гэж үзээд login
    //    дэлгэц рүү шидэх тул demo данс ХЭЗЭЭ Ч орж чадахгүй болно.
    if (name === 'claim_authorized_profile') {
      return Promise.resolve({ data: DEMO_USER, error: null });
    }
    if (name === 'admin_list_authorized_users') {
      return Promise.resolve({ data: demoTable('authorized_users'), error: null });
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

  /** Realtime — demo-д шууд шинэчлэлт хэрэггүй, гэхдээ унах ёсгүй. */
  channel() {
    const ch = { on() { return ch; }, subscribe() { return ch; }, unsubscribe() {} };
    return ch;
  },
  removeChannel() {},

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
