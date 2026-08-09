// Нэрээс тогтвортой өнгө + gradient сонгоно (Telegram маягийн аватар).
const PALETTE = [
  ['#FF885E', '#FF516A'],
  ['#FFCD6A', '#FFA85C'],
  ['#82B1FF', '#665FFF'],
  ['#A0DE7E', '#54CB68'],
  ['#53EDD6', '#28C9B7'],
  ['#72D5FD', '#2A9EF1'],
  ['#E0A2F3', '#D669ED'],
  ['#FF9EBB', '#FF5E9A'],
];

export function avatarGradient(name = '') {
  let hash = 0;
  const s = String(name);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
