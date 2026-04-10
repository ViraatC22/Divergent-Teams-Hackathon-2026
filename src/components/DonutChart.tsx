import React, { useRef, useEffect } from 'react';
import type { ClassificationLabel } from '../types';
import { CLASSIFICATION_COLORS } from '../config';

const ORDER: ClassificationLabel[] = ['Optimal', 'Drought Risk', 'Pest Alert', 'Terrain Warning'];

interface Props {
  counts: Record<ClassificationLabel, number>;
}

const SIZE   = 100;
const RADIUS = 42;
const INNER  = 28;

export const DonutChart: React.FC<Props> = ({ counts }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const cx = SIZE / 2;
    const cy = SIZE / 2;

    if (total === 0) {
      // Empty ring
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = RADIUS - INNER;
      ctx.stroke();
      return;
    }

    // Draw arc segments
    let startAngle = -Math.PI / 2;
    for (const label of ORDER) {
      const count = counts[label];
      if (count === 0) continue;
      const slice = (count / total) * Math.PI * 2;
      const endAngle = startAngle + slice;

      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, startAngle, endAngle);
      ctx.arc(cx, cy, INNER, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = CLASSIFICATION_COLORS[label] + 'cc'; // 80% opacity — softer
      ctx.fill();

      // Thin gap between segments
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(endAngle) * INNER, cy + Math.sin(endAngle) * INNER);
      ctx.lineTo(cx + Math.cos(endAngle) * RADIUS, cy + Math.sin(endAngle) * RADIUS);
      ctx.strokeStyle = '#131316';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle = endAngle;
    }

    // Center total
    ctx.fillStyle     = '#a1a1aa';
    ctx.font          = 'bold 13px JetBrains Mono, monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(`${total}`, cx, cy);
  }, [counts, total]);

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <canvas ref={canvasRef} className="block shrink-0" />
      <div className="flex flex-col gap-2">
        {ORDER.map(label => {
          const count = counts[label];
          const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: CLASSIFICATION_COLORS[label] }}
              />
              <span className="text-xs text-muted-foreground w-[110px]">{label}</span>
              <span className="font-mono text-xs text-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
