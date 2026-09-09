import type { NormalizeOptions } from '../types';

/** Exotic whitespace: NBSP, thin spaces, zero-width, ideographic space, BOM. */
const EXOTIC_WS = /[   -‍  　﻿\t\r\n]/g;

/**
 * Central normalisation for every compared value.
 *
 * Meaningful SERIAL characters (- _ / .) are NEVER stripped:
 *   "abc-001"  ->  "ABC-001"
 */
export function normalizeValue(value: unknown, opt: NormalizeOptions): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''; // NaN / Infinity
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  let s = String(value);
  if (s === 'NaN' || s === 'undefined' || s === 'null') return '';

  s = s.replace(EXOTIC_WS, ' ');
  s = s.replace(/ {2,}/g, ' ');

  if (opt.trim) s = s.trim();
  if (opt.ignoreInnerSpaces) s = s.replace(/ /g, '');
  if (opt.caseInsensitive) s = s.toUpperCase();

  return s;
}

/** Plain display normalisation used by search. */
export function normalizeLoose(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(EXOTIC_WS, ' ').replace(/ {2,}/g, ' ').trim().toUpperCase();
}

/** Values users enter to explicitly mark an item as unavailable/count-only. */
export function isMissingMarker(value: unknown): boolean {
  const normalized = normalizeLoose(value).replace(/\s+/g, ' ');
  return normalized === 'БАЙХГҮЙ' || normalized === 'ТООЛСОН' || normalized === 'TOOLSON';
}

/** Header key used for auto-detection: "Serial No." -> "SERIAL_NO." */
export function normalizeHeader(header: unknown): string {
  return String(header ?? '')
    .replace(EXOTIC_WS, ' ')
    .trim()
    .toUpperCase()
    .replace(/ +/g, '_');
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  return String(value).trim() === '';
}

type CellLike = string | number | boolean | null | undefined;

/** Text shown inside a cell. Does not alter the original data. */
export function displayValue(value: CellLike): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}
