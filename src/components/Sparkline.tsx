import React, { useRef, useEffect, useCallback } from 'react';
import { SPARKLINE_SAMPLES } from '../config';

interface Props {
  data: number[];
  color: string;
  height?: number;
}

export const Sparkline: React.FC<Props> = ({ data, color, height = 48 }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const displayData = data.slice(-SPARKLINE_SAMPLES);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use the actual CSS-rendered width — never set canvas.style.width here
    const W   = canvas.offsetWidth || 200;
    const H   = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (displayData.length < 2) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const min   = Math.min(...displayData);
    const max   = Math.max(...displayData);
    const range = max - min || 1;
    const pad   = 4;

    const toX = (i: number) => (i / (displayData.length - 1)) * W;
    const toY = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
    const pts = displayData.map((v, i) => ({ x: toX(i), y: toY(v) }));

    // Gradient fill
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   `rgba(${r},${g},${b},0.22)`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},0.05)`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0.0)`);

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.lineTo(pts[0].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Endpoint dot
    ctx.beginPath();
    ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [displayData, color, height]);

  // Redraw on data/color change
  useEffect(() => { draw(); }, [draw]);

  // Redraw on container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: `${height}px` }}
    />
  );
};
