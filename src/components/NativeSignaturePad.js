import React from 'react';
import SignaturePad from './SignaturePad';

/**
 * Админы гарын үсэг (анкет батлах).
 *
 * Өмнө нь энэ файл SignaturePad-ийн бүх логикийг ДАХИН бичсэн байсан —
 * хоёр тусдаа хувилбар нь ижил алдаатай (viewBox харьцаа таарахгүй тул
 * зураас хуруунаас зөрөх) байв. Одоо нэг л хэрэгжүүлэлт үлдсэн: алдаа
 * зассан бол хоёр газарт зэрэг засагдана.
 *
 * Ялгаа нь зөвхөн харагдах байдал: намхан самбар, компанийн хөх өнгө.
 */
export default function NativeSignaturePad({ onChange, label = 'Захирлын гарын үсэг' }) {
  return (
    <SignaturePad
      onChange={onChange}
      label={label}
      height={180}
      strokeColor="#16396f"
      exportStroke="#16396f"
    />
  );
}
