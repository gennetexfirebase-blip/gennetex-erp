/**
 * In-app knowledge base — ХААБ + суурилуулалт + FAQ; AI-д context өгнө.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_KEY = '@gennetex/knowledge_base_v1';

export const BUILTIN_ARTICLES = [
  {
    id: 'kb-safety-1',
    category: 'ХААБ',
    title: 'Өндөр ажил — үндсэн дүрэм',
    body: 'Шат/дээвэр дээр ажиллахдаа хамгаалалтын бүс, малгай, гутал заавал. Цахилгаан шугамтай ойр бол унтраалга шалгана. Ганцаараа өндөр ажил бүү хий.',
    tags: ['хааб', 'өндөр', 'аюулгүй'],
  },
  {
    id: 'kb-fiber-1',
    category: 'Суурилуулалт',
    title: 'ONU суурилуулалт — checklist',
    body: '1) Оптик түвшин power meter-ээр хэмжинэ (−8..−25 dBm). 2) SC/UPC цэвэрлэ. 3) ONU тэжээл + LAN. 4) MAC/SN бүртгэ. 5) Интернет/TV тест. 6) Харилцагчид заавар өг.',
    tags: ['onu', 'fiber', 'шинэ айл'],
  },
  {
    id: 'kb-fiber-2',
    category: 'Суурилуулалт',
    title: 'Fusion splice — алдаа багасгах',
    body: 'Cleaver цэвэр, fiber-ийн төгсгөл 90°. Splice loss 0.1 dB-ээс их бол дахин хий. Хамгаалалтын sleeve + tray-д зөв байрлуул.',
    tags: ['splice', 'оптик'],
  },
  {
    id: 'kb-repair-1',
    category: 'Засвар',
    title: 'Интернет байхгүй — оношилгоо',
    body: '1) ONU гэрэл (PON/LOS). 2) LAN/WiFi. 3) Кабель/RJ45. 4) Power adapter. 5) Central-тай MAC check. 6) Шаардлагатай бол ONU солих.',
    tags: ['гомдол', 'засвар'],
  },
  {
    id: 'kb-app-1',
    category: 'Апп',
    title: 'Дуудлага хаах — алхмууд',
    body: 'Програм/тест → харилцагчид мэдэгдэх → бараа бүртгэх → хаах төрөл сонгох → хаах. SLA 24 цаг.',
    tags: ['дуудлага', 'workflow'],
  },
  {
    id: 'kb-stock-1',
    category: 'Агуулах',
    title: 'Бараа авах / буцаах',
    body: 'ХААБ гарын үсэг зурсны дараа бараа/багаж авна. Айл дээр зарцуулсан барааг call close-д бүртгэнэ. Багаж буцаахдаа гэмтэл зурагтай.',
    tags: ['бараа', 'багаж'],
  },
];

export async function fetchArticles({ query, category } = {}) {
  if (!isFlagOn('knowledgeBase')) return [];
  let remote = [];
  if (supabase) {
    try {
      let q = supabase.from('knowledge_articles').select('*').eq('published', true).order('title');
      const { data, error } = await q.limit(200);
      if (!error && data) remote = data;
    } catch {}
  }

  let local = [];
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    local = raw ? JSON.parse(raw) : [];
  } catch {}

  let all = [...remote, ...local, ...BUILTIN_ARTICLES];
  // dedupe by id
  const seen = new Set();
  all = all.filter((a) => {
    const id = a.id || a.slug;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (category) {
    all = all.filter((a) => (a.category || '') === category);
  }
  if (query) {
    const q = query.trim().toLowerCase();
    all = all.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.body || '').toLowerCase().includes(q) ||
        (a.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  }
  return all;
}

export async function saveLocalArticle(article) {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const row = {
    id: article.id || `local-${Date.now()}`,
    category: article.category || 'Бусад',
    title: article.title,
    body: article.body,
    tags: article.tags || [],
    published: true,
  };
  list.unshift(row);
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
  return row;
}

/** Gennetex AI-д өгөх context snippet */
export async function buildAiKnowledgeContext(question) {
  const articles = await fetchArticles({ query: question });
  const top = articles.slice(0, 4);
  if (!top.length) return '';
  return top.map((a) => `### ${a.title}\n${a.body}`).join('\n\n');
}

export function listCategories(articles = BUILTIN_ARTICLES) {
  const set = new Set(articles.map((a) => a.category || 'Бусад'));
  return [...set];
}
