import { useEffect, useState } from 'react';

/**
 * Light / Dark / Систем (анхдагч — Dark). Сонголт localStorage-д; `<html data-theme>`-д
 * бодит (шийдэгдсэн) сэдэв бичигдэнэ — index.css үүгээр token-уудыг солино.
 * Анхны ачааллын «гялс» -аас сэргийлж index.html дотор ижил логик эрт ажилладаг.
 */
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'gx_theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    // Анхдагч — шөнийн горим (хэрэглэгч өөрөөр сонгоогүй бол).
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolve(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (media()?.matches ? 'dark' : 'light') : pref;
}

function apply(pref: ThemePref) {
  const t = resolve(pref);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#111312' : '#f7f7f6');
}

const EVT = 'gx-theme';

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  // Нэг хуудсан дээрх бүх товч ижил төлөвтэй байна.
  useEffect(() => {
    const on = (e: Event) => setPrefState((e as CustomEvent<ThemePref>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const setPref = (p: ThemePref) => window.dispatchEvent(new CustomEvent(EVT, { detail: p }));
  useEffect(() => {
    apply(pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* хувийн цонх */
    }
    if (pref !== 'system') return;
    const m = media();
    const on = () => apply('system');
    m?.addEventListener?.('change', on);
    return () => m?.removeEventListener?.('change', on);
  }, [pref]);
  return { pref, theme: resolve(pref), setPref };
}
