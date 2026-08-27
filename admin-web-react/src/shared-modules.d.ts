/**
 * Төслийн үндсэн (мобайлтай хуваалцсан) JS модулиудын төрлүүд.
 *
 * Эдгээр файл нь `admin-web/` дотор байрладаг — `.vercelignore` нь
 * `/src/`-ийг хасдаг тул вэб build дээр зөвхөн эндээс л хүрнэ.
 */
declare module '*/admin-web/attendance-report-builder.js' {
  export type ReportSheet = { name: string; rows: (string | number)[][] };
  export function buildDailyAttendanceSheets(p: {
    date: string;
    rows: unknown[];
    orgName?: string;
  }): ReportSheet[];
  export function buildRangeAttendanceSheets(p: {
    employeeName?: string;
    from: string;
    to: string;
    rows: unknown[];
  }): ReportSheet[];
  export function sheetsToPreview(sheets: ReportSheet[]): {
    header: string[];
    body: (string | number)[][];
    sheetName: string;
  };
  export const STATUS_LABEL: Record<string, string>;
}

declare module '*/admin-web/xlsx-chart.js' {
  const XlsxChart: {
    build: (o: unknown) => Uint8Array;
    toBase64: (b: Uint8Array) => string;
    fromBase64: (s: string) => Uint8Array;
  };
  export default XlsxChart;
}
