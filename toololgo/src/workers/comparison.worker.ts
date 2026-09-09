/// <reference lib="webworker" />
import { compareColumn } from '../lib/compare';
import type { ColumnResult, NormalizeOptions } from '../types';

export interface CompareRequest {
  type: 'compare';
  sourceSerial: unknown[] | null;
  refSerial: unknown[] | null;
  sourceDevc: unknown[] | null;
  refDevc: unknown[] | null;
  sourceTotal: number;
  referenceTotal: number;
  options: NormalizeOptions;
}

export type CompareResponse =
  | { type: 'progress'; phase: string; pct: number; detail?: string }
  | {
      type: 'result';
      serial: ColumnResult | null;
      devc: ColumnResult | null;
      serialRef: ColumnResult | null;
      devcRef: ColumnResult | null;
      sourceTotal: number;
      referenceTotal: number;
      durationMs: number;
    }
  | { type: 'error'; message: string };

const post = (msg: CompareResponse, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

self.onmessage = (event: MessageEvent<CompareRequest>) => {
  const req = event.data;
  if (req.type !== 'compare') return;

  const started = performance.now();
  try {
    const hasSerial = !!req.sourceSerial && !!req.refSerial;
    const hasDevc = !!req.sourceDevc && !!req.refDevc;
    const weight = hasSerial && hasDevc ? 0.5 : 1;

    let serial: ColumnResult | null = null;
    let devc: ColumnResult | null = null;
    let serialRef: ColumnResult | null = null;
    let devcRef: ColumnResult | null = null;

    if (hasSerial) {
      post({ type: 'progress', phase: 'serial', pct: 0.02, detail: 'SERIAL индекс бэлдэж байна...' });
      serial = compareColumn(req.sourceSerial!, req.refSerial!, req.options, (phase, p) => {
        post({
          type: 'progress',
          phase: 'serial',
          pct: p * weight * 0.98,
          detail: phase === 'index' ? 'SERIAL индекс...' : 'SERIAL харьцуулж байна...',
        });
      });
    }

    if (hasDevc) {
      const base = hasSerial ? 0.5 : 0;
      post({ type: 'progress', phase: 'devc', pct: base, detail: 'DEVC_NO индекс бэлдэж байна...' });
      devc = compareColumn(req.sourceDevc!, req.refDevc!, req.options, (phase, p) => {
        post({
          type: 'progress',
          phase: 'devc',
          pct: base + p * weight * 0.98,
          detail: phase === 'index' ? 'DEVC_NO индекс...' : 'DEVC_NO харьцуулж байна...',
        });
      });
    }

    // Урвуу харьцуулалт — цаанаас ирсэн утга манай тооллогод байгаа эсэх.
    if (hasSerial) {
      post({ type: 'progress', phase: 'serial-ref', pct: 0.99, detail: 'ЦААНААС SERIAL...' });
      serialRef = compareColumn(req.refSerial!, req.sourceSerial!, req.options);
    }
    if (hasDevc) {
      post({ type: 'progress', phase: 'devc-ref', pct: 0.99, detail: 'ЦААНААС DEVC_NO...' });
      devcRef = compareColumn(req.refDevc!, req.sourceDevc!, req.options);
    }

    const transfer: Transferable[] = [];
    for (const r of [serial, devc, serialRef, devcRef]) {
      if (!r) continue;
      transfer.push(
        r.status.buffer,
        r.refOccurrences.buffer,
        r.srcOccurrences.buffer,
        r.matchOffsets.buffer,
        r.matchRows.buffer,
      );
    }

    post(
      {
        type: 'result',
        serial,
        devc,
        serialRef,
        devcRef,
        sourceTotal: req.sourceTotal,
        referenceTotal: req.referenceTotal,
        durationMs: performance.now() - started,
      },
      transfer,
    );
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? `Харьцуулалт амжилтгүй: ${err.message}` : 'Харьцуулалт амжилтгүй боллоо.',
    });
  }
};
