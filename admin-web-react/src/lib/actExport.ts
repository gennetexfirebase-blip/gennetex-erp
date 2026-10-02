import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, ContentImage, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import reportLogo from '../assets/report-logo.png';
import type { Act, ActPhoto, ActReceiver, ActTemplate } from './acts';

(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 110) || 'Act';
}

export function actExportFilename(act: Act, extension: 'pdf' | 'docx') {
  return `${safeFilename(act.act_number)}_${safeFilename(act.project_name || 'Project')}.${extension}`;
}

function dateMn(value?: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()} оны ${date.getMonth() + 1} сарын ${date.getDate()}`;
}

async function urlToDataUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function urlToBytes(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'image/png' };
  } catch {
    return null;
  }
}

type PreparedStamp = { dataUrl: string; bytes: Uint8Array };
const preparedStampCache = new Map<string, Promise<PreparedStamp | null>>();

function prepareTransparentStamp(url?: string | null): Promise<PreparedStamp | null> {
  if (!url) return Promise.resolve(null);
  const cached = preparedStampCache.get(url);
  if (cached) return cached;
  const task = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = documentRef().createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const lightestInkChannel = Math.min(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
        if (lightestInkChannel >= 235) pixels.data[index + 3] = 0;
        else if (lightestInkChannel > 215) pixels.data[index + 3] = Math.round(255 * (235 - lightestInkChannel) / 20);
      }
      context.putImageData(pixels, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
      return dataUrl ? { dataUrl, bytes } : null;
    } catch { return null; }
  })();
  preparedStampCache.set(url, task);
  return task;
}

function receiverGroupKey(receiver: ActReceiver) {
  return `${receiver.type}|${receiver.audience_type}|${receiver.organization.trim().toLocaleLowerCase('mn')}`;
}

function groupReceivers(receivers: ActReceiver[]) {
  const groups = new Map<string, ActReceiver[]>();
  receivers.filter((receiver) => receiver.is_enabled !== false).forEach((receiver) => {
    const key = receiverGroupKey(receiver);
    groups.set(key, [...(groups.get(key) || []), receiver]);
  });
  return [...groups.values()];
}

function receiverGroupLabel(receiver: ActReceiver) {
  const organization = receiver.organization || (receiver.type === 'contractor' ? 'Женнетекс ХХК' : receiver.type === 'nextmind' ? 'Нексмайнд' : 'Байгууллага');
  const subject = /бүс$/i.test(organization) ? `${organization}ийг` : `${organization}-г`;
  return receiver.type === 'contractor'
    ? `${subject} төлөөлж хүлээлгэн өгсөн:`
    : `${subject} төлөөлөн хүлээж авсан:`;
}

function pdfChecklistMark(selected: boolean, check = false): Content {
  if (!selected) return '';
  if (!check) return { text: 'X', bold: true, alignment: 'center' };
  return {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2.5 8.5 6.3 12 13.7 3.8" fill="none" stroke="#191716" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    width: 11,
    alignment: 'center',
    margin: [0, 1, 0, 0],
  };
}

async function pdfReceiverGroup(group: ActReceiver[]): Promise<Content> {
  const rows = await Promise.all(group.map(async (receiver) => {
    const [signature, stamp] = await Promise.all([
      urlToDataUrl(receiver.signature_preview_url || receiver.signature_url),
      prepareTransparentStamp(receiver.stamp_preview_url || receiver.stamp_url),
    ]);
    const signatureStack: Content[] = stamp
      ? [{ image: stamp.dataUrl, fit: [100, 100], alignment: 'center', margin: [0, 0, 0, 0] } as ContentImage]
      : [signature
        ? { image: signature, fit: [105, 34], alignment: 'center', margin: [0, -4, 0, 0] } as ContentImage
        : { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 130, y2: 8, lineWidth: 0.7, dash: { length: 1.5, space: 1.5 }, lineColor: '#594A42' }], margin: [2, 0, 2, 0] }];
    return [
      { text: receiver.position || 'Албан тушаал', margin: [0, 5, 4, 0] },
      { stack: signatureStack },
      { text: `/${receiver.name || 'Нэр'}/`, bold: true, noWrap: true, margin: [4, 5, 0, 0] },
    ];
  }));
  return {
    stack: [
      { text: receiverGroupLabel(group[0]), bold: true, fontSize: 9.5, margin: [0, 0, 0, 4] },
      { table: { widths: ['*', 135, 115], body: rows }, layout: { hLineColor: () => '#ffffff', vLineColor: () => '#ffffff', paddingLeft: () => 0, paddingRight: () => 2, paddingTop: () => 0, paddingBottom: () => 1 } } as ContentTable,
    ],
    fontSize: 9,
    margin: [0, 6, 0, 4],
    unbreakable: true,
  };
}

function pdfPhotoPage(photos: Array<ActPhoto & { dataUrl: string }>, layout: 1 | 2 | 4, startIndex: number): Content[] {
  const cover: [number, number] = layout === 1 ? [490, 615] : layout === 2 ? [490, 268] : [230, 238];
  const blocks: Content[] = photos.map((photo, index) => ({
    table: {
      widths: ['*'],
      body: [[{
        fillColor: '#ffffff',
        stack: [
          { image: photo.dataUrl, cover: { width: cover[0], height: cover[1], align: 'center', valign: 'center' }, alignment: 'center', background: '#f7f7f6' } as ContentImage,
          { text: `Зураг ${startIndex + index + 1}${photo.caption ? ` (${photo.caption})` : ''}`, alignment: 'center', bold: true, color: '#211d1b', fontSize: 9, margin: [0, 7, 0, 1] },
        ],
      }]],
    },
    layout: {
      hLineColor: () => '#e4ded9',
      vLineColor: () => '#e4ded9',
      paddingLeft: () => 7,
      paddingRight: () => 7,
      paddingTop: () => 7,
      paddingBottom: () => 6,
    },
    margin: [2, 2, 2, layout === 4 ? 8 : 10] as [number, number, number, number],
  } as ContentTable));
  if (layout !== 4) return blocks;
  return [{
    table: { widths: ['*', '*'], body: [[blocks[0] || '', blocks[1] || ''], [blocks[2] || '', blocks[3] || '']] },
    layout: { hLineColor: () => '#ffffff', vLineColor: () => '#ffffff', paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 1, paddingBottom: () => 1 },
  } as ContentTable];
}

async function buildActPdf(act: Act, template?: ActTemplate) {
  const enabledReceivers = (act.receivers || []).filter((receiver) => receiver.is_enabled !== false);
  const receiverGroups = groupReceivers(enabledReceivers);
  const [logo, receiverBlocks, photoRows] = await Promise.all([
    urlToDataUrl(template?.logo_url || reportLogo),
    Promise.all(receiverGroups.map(pdfReceiverGroup)),
    Promise.all((act.photos || []).map(async (photo) => ({ ...photo, dataUrl: await urlToDataUrl(photo.preview_url || photo.image_url) }))),
  ]);
  const photos = photoRows.filter((photo) => photo.dataUrl);
  const content: Content[] = [
    { columns: [{ text: '', width: '*' }, { text: act.act_number, width: 'auto', fontSize: 9, color: '#555555' }] },
    { text: template?.title || (act.act_type === 'work_handover' ? 'АЖИЛ ХҮЛЭЭЛЦЭХ АКТ' : 'АЖИЛ ГҮЙЦЭТГЭЛИЙН АКТ'), alignment: 'center', bold: true, italics: true, fontSize: 18, margin: [0, 8, 0, 15] },
    {
      table: {
        widths: [190, '*'],
        body: [
          ['1. Хаяг / Байршил:', act.location || act.project_name || '—'],
          ['2. Гүйцэтгэгч компанийн нэр:', act.contractor_name || 'Женнетекс ХХК'],
          ['3. Захиалагч байгууллага:', act.customer_name || '—'],
          ['4. Гүйцэтгэсэн ажил:', act.work_description || '—'],
          ['5. Ажил эхэлсэн хугацаа:', dateMn(act.start_date)],
          ['6. Ажил дууссан хугацаа:', dateMn(act.end_date)],
        ].map(([label, value]) => [{ text: label, bold: true, italics: true }, { text: value, italics: true }]),
      },
      layout: { hLineColor: () => '#d6c8c0', vLineColor: () => '#ffffff', hLineStyle: () => ({ dash: { length: 1, space: 2 } }) },
      fontSize: 10.5,
      margin: [0, 0, 0, 14],
    },
    { text: 'Байранд зарцуулсан материалын хэмжээ', bold: true, italics: true, fontSize: 11, margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [24, '*', 72, 72],
        body: [
          [{ text: '№', bold: true }, { text: 'Бараа материал', bold: true }, { text: 'Хэмжих нэгж', bold: true }, { text: 'Тоо хэмжээ', bold: true }],
          ...(act.materials.length ? act.materials.map((item, index) => [index + 1, item.material_name, item.unit, item.quantity]) : [['', 'Материал бүртгээгүй', '', '']]),
        ],
      },
      layout: { fillColor: (row) => row === 0 ? '#f3eee9' : null, hLineColor: () => '#4b403a', vLineColor: () => '#4b403a' },
      fontSize: 9,
      pageBreak: 'after',
    } as ContentTable,
    { text: 'АЖИЛ ГҮЙЦЭТГЭХДЭЭ БАРИМТЛАХ ШААРДЛАГУУД', alignment: 'center', bold: true, fontSize: 12, margin: [0, 0, 0, 8] },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [20, '*', 36, 36, 36, 94],
        body: [
          [{ text: '№', bold: true }, { text: 'Шаардлага', bold: true }, { text: 'Тийм', bold: true }, { text: 'Үгүй', bold: true }, { text: 'N/A', bold: true }, { text: 'Шалтгаан', bold: true }],
          ...(act.checklists.length ? act.checklists.map((item, index) => [index + 1, item.requirement, pdfChecklistMark(item.result === 'yes', true), pdfChecklistMark(item.result === 'no'), pdfChecklistMark(item.result === 'na'), item.reason || '—']) : [['', 'Шалгах хуудас сонгоогүй', '', '', '', '']]),
        ],
      },
      layout: { fillColor: (row) => row === 0 ? '#f3eee9' : null, hLineColor: () => '#4b403a', vLineColor: () => '#4b403a' },
      fontSize: 7.5,
      margin: [0, 0, 0, 8],
    } as ContentTable,
    ...receiverBlocks,
  ];

  const perPage = act.photo_layout || 1;
  for (let index = 0; index < photos.length; index += perPage) {
    content.push({ text: 'АЖЛЫН ЗУРАГ', alignment: 'center', bold: true, color: '#28211e', characterSpacing: 1.2, fontSize: 12, margin: [0, 0, 0, 12], pageBreak: 'before' });
    content.push(...pdfPhotoPage(photos.slice(index, index + perPage), perPage, index));
  }

  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [42, 70, 42, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#191716' },
    header: () => ({
      margin: [42, 18, 42, 0],
      columns: [logo ? { image: logo, fit: [145, 45] } : { text: 'GENNETEX', bold: true, color: '#7f1d1d', fontSize: 16 }],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [42, 0, 42, 12],
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 511, h: 3, color: '#8b2e23' }] },
        { columns: [{ text: template?.footer_text || 'Ажил хүлээлцэх акт', italics: true, fontSize: 8, margin: [0, 6, 0, 0] }, { text: `хуудас ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8, margin: [0, 6, 0, 0] }] },
      ],
    }),
    content,
    info: { title: `${act.act_number} ${act.project_name}`, author: 'Gennetex ERP', subject: template?.title || 'Ажил гүйцэтгэлийн акт' },
  };
  return pdfMake.createPdf(definition);
}

export async function createActPdfBlob(act: Act, template?: ActTemplate): Promise<Blob> {
  const pdf = await buildActPdf(act, template);
  return pdf.getBlob();
}

export async function downloadActPdf(act: Act, template?: ActTemplate) {
  const pdf = await buildActPdf(act, template);
  pdf.download(actExportFilename(act, 'pdf'));
}

const border = { style: BorderStyle.SINGLE, size: 2, color: '594A42' };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };

function textCell(text: string | number, bold = false, width?: number) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold, size: 18 })] })],
  });
}

function title(text: string) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 150, after: 180 }, children: [new TextRun({ text, bold: true, italics: true, size: 32 })] });
}

async function coverImageBytes(url: string, width: number, height: number) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = 2;
    const canvas = documentRef().createElement('canvas');
    canvas.width = width * scale; canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const ratio = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const drawWidth = bitmap.width * ratio; const drawHeight = bitmap.height * ratio;
    context.drawImage(bitmap, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' } : null;
  } catch { return null; }
}

async function docxImage(url: string, width: number, height: number, cover = false) {
  const image = cover ? await coverImageBytes(url, width, height) : await urlToBytes(url);
  if (!image) return null;
  const type = image.mime.includes('jpeg') || image.mime.includes('jpg') ? 'jpg' : image.mime.includes('webp') ? 'png' : 'png';
  return new ImageRun({ data: image.bytes, transformation: { width, height }, type });
}

async function docxStampImage(url: string, width: number, height: number) {
  const stamp = await prepareTransparentStamp(url);
  return stamp ? new ImageRun({ data: stamp.bytes, transformation: { width, height }, type: 'png' }) : null;
}

export async function downloadActDocx(act: Act, template?: ActTemplate) {
  const enabledReceivers = (act.receivers || []).filter((receiver) => receiver.is_enabled !== false);
  const receiverGroups = groupReceivers(enabledReceivers);
  const logo = await docxImage(template?.logo_url || reportLogo, 170, 52);
  const signatureImages = await Promise.all(enabledReceivers.map(async (receiver) => ({
    signature: await docxImage(receiver.signature_preview_url || receiver.signature_url, 125, 45),
    stamp: await docxStampImage(receiver.stamp_preview_url || receiver.stamp_url, 130, 130),
  })));
  const photoImages = await Promise.all(act.photos.map(async (photo) => ({ photo, image: await docxImage(photo.preview_url || photo.image_url, act.photo_layout === 1 ? 600 : act.photo_layout === 2 ? 500 : 270, act.photo_layout === 1 ? 660 : 300, true) })));
  const children: Array<Paragraph | Table> = [
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: act.act_number, size: 18, color: '666666' })] }),
    title(template?.title || (act.act_type === 'work_handover' ? 'АЖИЛ ХҮЛЭЭЛЦЭХ АКТ' : 'АЖИЛ ГҮЙЦЭТГЭЛИЙН АКТ')),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.DOTTED, size: 2, color: 'B7A49B' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.DOTTED, size: 2, color: 'B7A49B' }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        ['1. Хаяг / Байршил:', act.location || act.project_name || '—'],
        ['2. Гүйцэтгэгч компанийн нэр:', act.contractor_name || 'Женнетекс ХХК'],
        ['3. Захиалагч байгууллага:', act.customer_name || '—'],
        ['4. Гүйцэтгэсэн ажил:', act.work_description || '—'],
        ['5. Ажил эхэлсэн хугацаа:', dateMn(act.start_date)],
        ['6. Ажил дууссан хугацаа:', dateMn(act.end_date)],
      ].map(([label, value]) => new TableRow({ cantSplit: true, children: [textCell(label, true, 40), textCell(value, false, 60)] })),
    }),
    new Paragraph({ spacing: { before: 220, after: 100 }, children: [new TextRun({ text: 'Байранд зарцуулсан материалын хэмжээ', bold: true, italics: true, size: 22 })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders,
      rows: [
        new TableRow({ tableHeader: true, children: [textCell('№', true, 8), textCell('Бараа материал', true, 52), textCell('Хэмжих нэгж', true, 20), textCell('Тоо хэмжээ', true, 20)] }),
        ...(act.materials.length ? act.materials.map((item, index) => new TableRow({ cantSplit: true, children: [textCell(index + 1), textCell(item.material_name), textCell(item.unit), textCell(item.quantity)] })) : [new TableRow({ children: [textCell(''), textCell('Материал бүртгээгүй'), textCell(''), textCell('')] })]),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
    title('АЖИЛ ГҮЙЦЭТГЭХДЭЭ БАРИМТЛАХ ШААРДЛАГУУД'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders,
      rows: [
        new TableRow({ tableHeader: true, children: ['№', 'Шаардлага', 'Тийм', 'Үгүй', 'N/A', 'Шалтгаан'].map((value) => textCell(value, true)) }),
        ...(act.checklists.length ? act.checklists.map((item, index) => new TableRow({ cantSplit: true, children: [textCell(index + 1), textCell(item.requirement), textCell(item.result === 'yes' ? '✓' : ''), textCell(item.result === 'no' ? 'X' : ''), textCell(item.result === 'na' ? 'X' : ''), textCell(item.reason || '—')] })) : [new TableRow({ children: [textCell(''), textCell('Шалгах хуудас сонгоогүй'), textCell(''), textCell(''), textCell(''), textCell('')] })]),
      ],
    }),
  ];

  receiverGroups.forEach((group) => {
    children.push(new Paragraph({ spacing: { before: 180, after: 70 }, children: [new TextRun({ text: receiverGroupLabel(group[0]), bold: true, size: 20 })] }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: group.map((receiver) => {
      const images = signatureImages[enabledReceivers.indexOf(receiver)];
      return new TableRow({ cantSplit: true, children: [
        textCell(receiver.position || 'Албан тушаал', false, 43),
        new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: images.stamp
          ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [images.stamp] })]
          : [new Paragraph({ alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.DOTTED, size: 2, color: '594A42' } }, children: [images.signature || new TextRun(' ')] })]
        }),
        textCell(`/${receiver.name || 'Нэр'}/`, true, 25),
      ] });
    }) }));
  });

  const usablePhotos = photoImages.filter((item) => item.image);
  usablePhotos.forEach((item, index) => {
    if (index % (act.photo_layout || 1) === 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(title('АЖЛЫН ЗУРАГ'));
    }
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [item.image!] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 50, after: 120 }, children: [new TextRun({ text: `Зураг ${index + 1}${item.photo.caption ? ` (${item.photo.caption})` : ''}`, bold: true, color: '211D1B', size: 18 })] }));
  });

  const document = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: logo ? [logo] : [new TextRun({ text: 'GENNETEX', bold: true, color: '7F1D1D', size: 28 })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ border: { top: { style: BorderStyle.THICK, size: 12, color: '8B2E23' } }, children: [new TextRun({ text: template?.footer_text || 'Ажил хүлээлцэх акт', italics: true, size: 16 }), new TextRun({ text: '                                      хуудас ', size: 16 }), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun({ text: ' / ', size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES] })] })] }) },
    children,
  }] });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = documentRef().createElement('a');
  anchor.href = url;
  anchor.download = actExportFilename(act, 'docx');
  documentRef().body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function documentRef() {
  return window.document;
}
