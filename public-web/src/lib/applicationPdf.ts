import type { JobApplicationFormData } from '../types/jobApplication';
import { buildApplicationPaperHtml } from './jobApplicationPaper';

export function buildApplicationPrintHtml(data: JobApplicationFormData) {
  return buildApplicationPaperHtml(data, { logoUrl: '/logo.png' });
}

export async function downloadApplicationPdf(data: JobApplicationFormData) {
  const html = buildApplicationPrintHtml(data);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 400));
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

export function printApplication(data: JobApplicationFormData) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildApplicationPrintHtml(data));
  w.document.close();
  w.focus();
  w.print();
}
