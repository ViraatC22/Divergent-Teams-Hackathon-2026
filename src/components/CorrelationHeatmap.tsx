import React, { useRef, useEffect } from 'react';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { correlationColor } from '../engine/correlation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props { matrix: number[][]; insights: string[]; }

export const CorrelationHeatmap: React.FC<Props> = ({ matrix, insights }) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const n          = CHANNELS.length;
  const cellSize   = 50;
  const labelW     = 76;
  const canvasSize = n * cellSize + labelW;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matrix.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width  = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = matrix[i]?.[j] ?? 0;
        const x = labelW + j * cellSize;
        const y = labelW + i * cellSize;
        ctx.fillStyle = correlationColor(r);
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
        ctx.fillStyle = Math.abs(r) > 0.6 ? '#e4e4e7' : '#52525b';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.toFixed(2), x + cellSize / 2, y + cellSize / 2);
      }
    }

    ctx.fillStyle = '#52525b';
    ctx.font = '11px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < n; j++) {
      ctx.fillText(CHANNEL_LABELS[CHANNELS[j]].slice(0, 7), labelW + j * cellSize + cellSize / 2, labelW / 2);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i < n; i++) {
      ctx.fillText(CHANNEL_LABELS[CHANNELS[i]].slice(0, 9), labelW - 5, labelW + i * cellSize + cellSize / 2);
    }
  }, [matrix, canvasSize, n]);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm">
          Correlation Heatmap
          <span className="ml-2 text-xs font-normal text-muted-foreground">updates every 30s</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-10 rounded-sm" style={{ background: 'linear-gradient(to right, rgb(100,100,255), rgb(255,255,255), rgb(255,100,100))' }} />
          <span>−1 → 0 → +1</span>
        </div>

        {matrix.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground italic">Collecting data…</p>
        ) : (
          <canvas ref={canvasRef} className="block mb-4" />
        )}

        {insights.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Insights (|r| &gt; 0.7)
            </p>
            {insights.map((ins, i) => (
              <div key={i} className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                <span className="mr-1.5 text-emerald-400">›</span>{ins}
              </div>
            ))}
          </div>
        )}

        {insights.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No strong correlations yet (|r| &gt; 0.7 threshold)
          </p>
        )}
      </CardContent>
    </Card>
  );
};
