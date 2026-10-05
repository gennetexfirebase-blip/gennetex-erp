import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { Button } from './ui';

export default function SignatureCanvas({ onChange }: { onChange: (blob: Blob | null, preview: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const previous = document.createElement('canvas');
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#111827';
      if (!empty && previous.width) context.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, rect.width, rect.height);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [empty]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    const context = event.currentTarget.getContext('2d');
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = point(event);
    const context = event.currentTarget.getContext('2d');
    context?.lineTo(p.x, p.y);
    context?.stroke();
    setEmpty(false);
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    canvas.toBlob((blob) => blob && onChange(blob, canvas.toDataURL('image/png')), 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null, '');
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><PenLine size={14} /> Mouse эсвэл touch-аар зурна уу</span>
        <Button type="button" variant="ghost" className="!px-2 !py-1" icon={<Eraser size={14} />} onClick={clear}>Цэвэрлэх</Button>
      </div>
      <canvas
        ref={canvasRef}
        className="h-36 w-full touch-none rounded-[var(--radius-sm)] border border-dashed border-line bg-card"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="Гарын үсэг зурах талбар"
      />
    </div>
  );
}
