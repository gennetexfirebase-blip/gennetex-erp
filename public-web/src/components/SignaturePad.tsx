import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onChange: (svg: string) => void;
  disabled?: boolean;
}

const W = 600;
const H = 180;

export default function SignaturePad({ onChange, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const getCtx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#fafafa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    onChange('');
    setHasInk(false);
  }, [onChange]);

  useEffect(() => {
    if (disabled) {
      drawing.current = false;
      clearCanvas();
    }
  }, [disabled, clearCanvas]);

  const emit = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const blank = document.createElement('canvas');
    blank.width = W;
    blank.height = H;
    const data = c.toDataURL();
    const empty = blank.toDataURL();
    if (data === empty) {
      onChange('');
      setHasInk(false);
      return;
    }
    onChange(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><image href="${data}" width="${W}" height="${H}"/></svg>`);
    setHasInk(true);
  }, [onChange]);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-disabled={disabled}
        className={`w-full rounded-lg border border-graphite-700 bg-graphite-900 touch-none ${
          disabled ? 'cursor-not-allowed' : 'cursor-crosshair'
        }`}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-graphite-500">
        <span>
          {disabled
            ? 'Эхлээд дүрмийг уншиж зөвшөөрнө үү'
            : hasInk
              ? 'Зурсан'
              : 'Энд гарын үсгээ зурна уу'}
        </span>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled}
          className="text-accent hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          Цэвэрлэх
        </button>
      </div>
    </div>
  );
}
