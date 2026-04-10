import React, { useRef, useEffect } from 'react';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { correlationColor } from '../engine/correlation';

interface Props {
  matrix: number[][];
  insights: string[];
}

export const CorrelationHeatmap: React.FC<Props> = ({ matrix, insights }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = CHANNELS.length;
  const cellSize = 52;
  const labelW = 80;
  const canvasSize = n * cellSize + labelW;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matrix.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = matrix[i]?.[j] ?? 0;
        const x = labelW + j * cellSize;
        const y = labelW + i * cellSize;

        ctx.fillStyle = correlationColor(r);
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

        // Value text
        ctx.fillStyle = Math.abs(r) > 0.5 ? '#0f1419' : '#e2e8f0';
        ctx.font = `bold 11px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.toFixed(2), x + cellSize / 2, y + cellSize / 2);
      }
    }

    // Column labels (top)
    ctx.fillStyle = '#64748b';
    ctx.font = `11px DM Sans, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < n; j++) {
      const x = labelW + j * cellSize + cellSize / 2;
      const label = CHANNEL_LABELS[CHANNELS[j]];
      ctx.save();
      ctx.translate(x, labelW / 2);
      ctx.fillText(label.slice(0, 8), 0, 0);
      ctx.restore();
    }

    // Row labels (left)
    ctx.textAlign = 'right';
    for (let i = 0; i < n; i++) {
      const y = labelW + i * cellSize + cellSize / 2;
      const label = CHANNEL_LABELS[CHANNELS[i]];
      ctx.fillText(label.slice(0, 10), labelW - 6, y);
    }
  }, [matrix, canvasSize, n]);

  return (
    <div className="card">
      <div className="section-title">Correlation Heatmap <span style={{ fontSize: 10, fontWeight: 400 }}>(updates every 30s)</span></div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ width: 40, height: 8, background: 'linear-gradient(to right, rgb(0,0,255), rgb(255,255,255), rgb(255,0,0))', borderRadius: 2 }} />
        <span>-1 → 0 → +1</span>
      </div>

      <canvas ref={canvasRef} style={{ display: 'block', marginBottom: 16 }} />

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Insights (|r| &gt; 0.7)
          </div>
          {insights.map((ins, i) => (
            <div key={i} style={{
              fontSize: 12,
              padding: '6px 10px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              marginBottom: 4,
              color: '#94a3b8',
              lineHeight: 1.4,
            }}>
              <span style={{ color: '#22c55e', marginRight: 6 }}>▸</span>
              {ins}
            </div>
          ))}
        </div>
      )}

      {insights.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No strong correlations detected yet (need more data or |r| &gt; 0.7)
        </div>
      )}
    </div>
  );
};
