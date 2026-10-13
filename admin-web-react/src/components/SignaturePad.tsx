import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';

export type SignaturePadHandle = { clear: () => void; isEmpty: () => boolean; toBlob: () => Promise<Blob | null> };

/**
 * Хуруу / хулганаар гарын үсэг зурах самбар. Тунгалаг дэвсгэртэй PNG
 * гаргана — PDF дээр шууд тавигдана.
 */
export default forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Retina дэлгэц дээр тод харагдахын тулд пикселийн нягтралаар томруулна.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0b2e7a';
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const markDrawn = () => {
    if (empty) {
      setEmpty(false);
      onChange?.(false);
    }
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      const c = canvas.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      setEmpty(true);
      onChange?.(true);
    },
    isEmpty: () => empty,
    toBlob: () => new Promise((resolve) => (canvas.current ? canvas.current.toBlob(resolve, 'image/png') : resolve(null))),
  }));

  return (
    <canvas
      ref={canvas}
      className="h-44 w-full touch-none rounded-[var(--radius)] border-2 border-dashed border-[var(--border-strong)] bg-white"
      aria-label="Гарын үсэг зурах талбар"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = point(e);
        const ctx = e.currentTarget.getContext('2d');
        if (ctx && last.current) {
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#0b2e7a';
          ctx.fill();
        }
        markDrawn();
      }}
      onPointerMove={(e) => {
        if (!drawing.current || !last.current) return;
        const ctx = e.currentTarget.getContext('2d');
        const pt = point(e);
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
        last.current = pt;
      }}
      onPointerUp={() => {
        drawing.current = false;
        last.current = null;
      }}
      onPointerLeave={() => {
        drawing.current = false;
        last.current = null;
      }}
    />
  );
});
