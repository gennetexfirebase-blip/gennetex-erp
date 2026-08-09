import { supabase } from './supabase';
import { DEFAULT_SITE_CONTENT } from './siteContentDefaults';

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  if (Array.isArray(patch)) return patch.map((item, i) => (typeof item === 'object' && item && base?.[i] ? deepMerge(base[i], item) : item));
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value;
    } else if (value && typeof value === 'object' && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function mergeSiteContent(partial) {
  return deepMerge(DEFAULT_SITE_CONTENT, partial || {});
}

export async function fetchSiteContent() {
  try {
    const { data, error } = await supabase
      .from('public_site_content')
      .select('content, updated_at')
      .eq('id', 'main')
      .maybeSingle();
    if (error) {
      console.warn('[siteContent]', error.message);
      return { content: DEFAULT_SITE_CONTENT, updatedAt: null };
    }
    if (!data) return { content: DEFAULT_SITE_CONTENT, updatedAt: null };
    return {
      content: mergeSiteContent(data.content || {}),
      updatedAt: data.updated_at || null,
    };
  } catch (e) {
    console.warn('[siteContent]', e);
    return { content: DEFAULT_SITE_CONTENT, updatedAt: null };
  }
}

export function formatCopyright(text) {
  return String(text || '').replace(/\{year\}/g, String(new Date().getFullYear()));
}
