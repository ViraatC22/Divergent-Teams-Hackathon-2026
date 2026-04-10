import React, { useRef, useEffect } from 'react';
import type { ClassificationLabel } from '../types';
import { CLASSIFICATION_COLORS } from '../config';

const ORDER: ClassificationLabel[] = ['Optimal', 'Drought Risk', 'Pest Alert', 'Terrain Warning'];

interface Props {
  counts: Record<ClassificationLabel, number>;
}

const SIZE = 120;

export const DonutChart: React.FC<Props> = ({ counts }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#2a3441';
      ctx.lineWidth = 16;
      ctx.stroke();
      return;
    }

    let startAngle = -Math.PI / 2;
    for (const label of ORDER) {
      const count = counts[label];
      if (count === 0) continue;
      const slice = (count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, SIZE / 2);
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = CLASSIFICATION_COLORS[label];
      ctx.fill();
      startAngle += slice;
    }

    // Donut hole
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 28, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--bg-card)';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total}`, SIZE / 2, SIZE / 2);
  }, [counts, total]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <canvas ref={canvasRef} style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ORDER.map(label => {
          const count = counts[label];
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: CLASSIFICATION_COLORS[label], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-primary)' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
