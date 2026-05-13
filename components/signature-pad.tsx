"use client";

/**
 * SignaturePad - HTML5 canvas signature input.
 *
 *  - Mouse + touch (works on phones/tablets)
 *  - "Clear" button to redo
 *  - Reports whether the user has drawn anything (so the parent can disable Submit)
 *  - Returns a PNG Blob via `getBlob()`
 *
 * Usage:
 *   const ref = useRef<SignaturePadHandle>(null);
 *   <SignaturePad ref={ref} onChangeIsEmpty={setEmpty} />
 *   const blob = await ref.current!.getBlob();
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type SignaturePadHandle = {
  clear: () => void;
  getBlob: () => Promise<Blob | null>;
  isEmpty: () => boolean;
};

type Props = {
  height?: number;
  onChangeIsEmpty?: (empty: boolean) => void;
};

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 200, onChangeIsEmpty },
  externalRef
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Resize canvas to match its container, accounting for device pixel ratio
  // so strokes stay crisp on retina screens.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0A0A0A";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const updateEmpty = useCallback(
    (next: boolean) => {
      setEmpty(next);
      onChangeIsEmpty?.(next);
    },
    [onChangeIsEmpty]
  );

  const pointFrom = (e: PointerEvent | React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    const c = canvasRef.current!;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFrom(e);
    updateEmpty(false);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const p = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const handlePointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleClear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(dpr, dpr);
    ctx.restore();
    updateEmpty(true);
  };

  useImperativeHandle(
    externalRef,
    () => ({
      clear: handleClear,
      isEmpty: () => empty,
      getBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const c = canvasRef.current;
          if (!c) return resolve(null);
          // Render onto a clean white background so it looks good in the PDF.
          const tmp = document.createElement("canvas");
          tmp.width = c.width;
          tmp.height = c.height;
          const tctx = tmp.getContext("2d");
          if (!tctx) return resolve(null);
          tctx.fillStyle = "#ffffff";
          tctx.fillRect(0, 0, tmp.width, tmp.height);
          tctx.drawImage(c, 0, 0);
          tmp.toBlob((b) => resolve(b), "image/png");
        }),
    }),
    [empty]
  );

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-xl2 border border-line bg-white shadow-soft"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-ink-subtle">
            Sign here ·  draw with mouse or finger
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleClear}
          disabled={empty}
          className="text-[12.5px] text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
        >
          Clear signature
        </button>
      </div>
    </div>
  );
});
