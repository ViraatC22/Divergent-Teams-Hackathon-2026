import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { SensorPacket, ClassificationLabel, ChannelName } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS, CHANNEL_UNITS, CLASSIFICATION_COLORS } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface ClassificationPoint {
  timestamp: number;
  label: ClassificationLabel;
}

interface Props {
  packets: SensorPacket[];
  classificationHistory: ClassificationPoint[];
}

const CHANNEL_COLORS: Record<ChannelName, string> = {
  altitude:     '#3b82f6',
  temperature:  '#f97316',
  pressure:     '#a78bfa',
  soilPercent:  '#22c55e',
  vibrationRMS: '#f59e0b',
};

const H     = 200;
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 10;
const PAD_B = 30;

export const HistoricalChart: React.FC<Props> = ({ packets, classificationHistory }) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wRef       = useRef(600); // tracks actual rendered canvas width
  const [ch1, setCh1]           = useState<ChannelName>('temperature');
  const [ch2, setCh2]           = useState<ChannelName>('soilPercent');
  const [viewMode, setViewMode] = useState<'5min' | 'session'>('5min');

  const viewOffsetRef = useRef(0);
  const viewZoomRef   = useRef(1);
  const dragStartRef  = useRef<{ x: number; offset: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use actual CSS-rendered width; never set canvas.style.width
    const W   = canvas.offsetWidth || 600;
    wRef.current = W;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const displayPackets = viewMode === '5min' ? packets.slice(-150) : packets;
    if (displayPackets.length < 2) {
      ctx.fillStyle = '#52525b';
      ctx.font      = '12px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting data…', W / 2, H / 2);
      return;
    }

    const zoom         = viewZoomRef.current;
    const totalPoints  = displayPackets.length;
    const visibleCount = Math.max(5, Math.floor(totalPoints / zoom));
    const offset       = Math.min(viewOffsetRef.current, totalPoints - visibleCount);
    const startIdx     = Math.max(0, totalPoints - visibleCount - offset);
    const endIdx       = Math.min(totalPoints, startIdx + visibleCount);
    const visible      = displayPackets.slice(startIdx, endIdx);

    if (visible.length < 2) return;

    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const toX    = (i: number) => PAD_L + (i / (visible.length - 1)) * chartW;

    const drawChannel = (ch: ChannelName, yAxis: 'left' | 'right') => {
      const vals  = visible.map(p => p[ch] as number);
      const minV  = Math.min(...vals);
      const maxV  = Math.max(...vals);
      const range = maxV - minV || 1;
      const toY   = (v: number) => PAD_T + chartH - ((v - minV) / range) * chartH;
      const color = CHANNEL_COLORS[ch];

      for (let i = 0; i < visible.length - 1; i++) {
        const ts     = visible[i].timestamp;
        const active = [...classificationHistory].reverse().find(c => c.timestamp <= ts);
        if (active && active.label !== 'Optimal') {
          ctx.fillStyle = CLASSIFICATION_COLORS[active.label] + '18';
          ctx.fillRect(toX(i), PAD_T, toX(i + 1) - toX(i), chartH);
        }
      }

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < vals.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font      = '10px JetBrains Mono, monospace';
      if (yAxis === 'left') {
        ctx.textAlign = 'right';
        ctx.fillText(`${maxV.toFixed(1)}`, PAD_L - 4, PAD_T + 10);
        ctx.fillText(`${minV.toFixed(1)}`, PAD_L - 4, H - PAD_B - 2);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(`${maxV.toFixed(1)}`, W - PAD_R + 4, PAD_T + 10);
        ctx.fillText(`${minV.toFixed(1)}`, W - PAD_R + 4, H - PAD_B - 2);
      }
    };

    drawChannel(ch1, 'left');
    if (ch2 !== ch1) drawChannel(ch2, 'right');

    ctx.fillStyle = '#52525b';
    ctx.font      = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const t0      = visible[0].timestamp;
    const t1      = visible[visible.length - 1].timestamp;
    const fmt     = (ts: number) => {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    };
    ctx.fillText(fmt(t0), PAD_L, H - 4);
    ctx.fillText(fmt(t1), W - PAD_R, H - 4);

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, H - PAD_B);
    ctx.lineTo(W - PAD_R, H - PAD_B);
    ctx.stroke();
  }, [packets, classificationHistory, ch1, ch2, viewMode]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    viewZoomRef.current = Math.max(1, Math.min(20, viewZoomRef.current + e.deltaY * 0.01));
    draw();
  }, [draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, offset: viewOffsetRef.current };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const W          = wRef.current;
    const dx         = dragStartRef.current.x - e.clientX;
    const total      = viewMode === '5min' ? Math.min(packets.length, 150) : packets.length;
    const visible    = Math.max(5, Math.floor(total / viewZoomRef.current));
    const pxPerSample = (W - PAD_L - PAD_R) / visible;
    const delta      = Math.round(dx / pxPerSample);
    viewOffsetRef.current = Math.max(0, Math.min(total - visible, dragStartRef.current.offset + delta));
    draw();
  }, [draw, packets.length, viewMode]);

  const handleMouseUp = useCallback(() => { dragStartRef.current = null; }, []);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const handleMouseMoveTooltip = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current) { handleMouseMove(e); return; }
    const W       = wRef.current;
    const rect    = canvasRef.current!.getBoundingClientRect();
    const mx      = e.clientX - rect.left;
    const display = viewMode === '5min' ? packets.slice(-150) : packets;
    if (display.length < 2) return;
    const zoom        = viewZoomRef.current;
    const total       = display.length;
    const visCnt      = Math.max(5, Math.floor(total / zoom));
    const offset      = Math.min(viewOffsetRef.current, total - visCnt);
    const startIdx    = Math.max(0, total - visCnt - offset);
    const vis         = display.slice(startIdx, Math.min(total, startIdx + visCnt));
    const chartW      = W - PAD_L - PAD_R;
    const idx         = Math.round(((mx - PAD_L) / chartW) * (vis.length - 1));
    if (idx < 0 || idx >= vis.length) { setTooltip(null); return; }
    const p     = vis[idx];
    const ts    = new Date(p.timestamp);
    const cls   = [...classificationHistory].reverse().find(c => c.timestamp <= p.timestamp);
    const fmt   = (n: number) => n.toString().padStart(2, '0');
    const label = `${fmt(ts.getHours())}:${fmt(ts.getMinutes())}:${fmt(ts.getSeconds())}  ${CHANNEL_LABELS[ch1]}: ${(p[ch1] as number).toFixed(2)} | ${CHANNEL_LABELS[ch2]}: ${(p[ch2] as number).toFixed(2)}  [${cls?.label ?? 'Optimal'}]`;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: label });
  }, [packets, classificationHistory, ch1, ch2, viewMode, handleMouseMove]);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-sm">Historical Charts</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={ch1}
              onChange={e => setCh1(e.target.value as ChannelName)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">vs</span>
            <select
              value={ch2}
              onChange={e => setCh2(e.target.value as ChannelName)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>)}
            </select>
            <Button size="sm" variant={viewMode === '5min' ? 'default' : 'outline'} className="h-7 text-xs px-2" onClick={() => setViewMode('5min')}>5 min</Button>
            <Button size="sm" variant={viewMode === 'session' ? 'default' : 'outline'} className="h-7 text-xs px-2" onClick={() => setViewMode('session')}>Session</Button>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span><span style={{ color: CHANNEL_COLORS[ch1] }}>━</span> {CHANNEL_LABELS[ch1]} ({CHANNEL_UNITS[ch1]})</span>
            {ch2 !== ch1 && <span><span style={{ color: CHANNEL_COLORS[ch2] }}>━</span> {CHANNEL_LABELS[ch2]} ({CHANNEL_UNITS[ch2]})</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="relative cursor-crosshair select-none">
          <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveTooltip}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
            className="block w-full"
            style={{ height: H }}
          />
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 rounded border border-border bg-zinc-900 px-2 py-1 font-mono text-[11px] text-foreground whitespace-nowrap"
              style={{ left: Math.min(tooltip.x + 10, wRef.current - 300), top: tooltip.y - 30 }}
            >
              {tooltip.content}
            </div>
          )}
        </div>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">scroll to zoom · drag to pan</p>
      </CardContent>
    </Card>
  );
};
