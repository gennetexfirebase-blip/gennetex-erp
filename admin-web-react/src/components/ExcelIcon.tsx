import excelPng from '../assets/excel-icon.png';

/**
 * Microsoft Excel-ийн албан ёсны тэмдэг.
 *
 * Excel-тэй холбоотой БҮХ товч энэ компонентыг ашиглана — мобайл
 * талын `src/components/ExcelIcon.js` мөн ижил зургийг ачаалдаг тул
 * хоёр тал ижил харагдана.
 *
 * Эх зураг 500×514 тул өндөр нь өргөнөөс арай их — харьцааг хадгална.
 */
const RATIO = 514 / 500;

export default function ExcelIcon({ size = 16 }: { size?: number }) {
  return (
    <img
      src={excelPng}
      alt=""
      aria-hidden
      width={size}
      height={Math.round(size * RATIO)}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}
