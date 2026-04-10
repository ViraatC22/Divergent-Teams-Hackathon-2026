import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { SensorPacket, ClassificationLabel, ChannelName } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS, CHANNEL_UNITS, CLASSIFICATION_COLORS } from '../config';

interface ClassificationPoint {
  timestamp: number;
  label: ClassificationLabel;
}

interface Props {
  packets: SensorPacket[];
  classificationHistory: ClassificationPoint[];
}

const CHANNEL_COLORS: Record<ChannelName, string> = {
  distance: '#3b82f6',
  temperature: '#f97316',
  pressure: '#a78bfa',
  soilPercent: '#22c55e',
  vibrationRMS: '#f59e0b',
};

const W = 600;
const H = 200;
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 10;
const PAD_B = 30;

export const HistoricalChart: React.FC<Props> = ({ packets, classificationHistory }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ch1, setCh1] = useState<ChannelName>('temperature');
  const [ch2, setCh2] = useState<ChannelName>('soilPercent');
  const [viewMode, setViewMode] = useState<'5min' | 'session'>('5min');

  // Pan/zoom state
  const viewOffsetRef = useRef(0); // samples offset from end
  const viewZoomRef = useRef(1);   // 1 = full view, >1 = zoomed in
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const displayPackets = viewMode === '5min' ? packets.slice(-150) : packets;
    if (displayPackets.length < 2) {
      ctx.fillStyle = '#475569';
      ctx.font = '12px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting data…', W / 2, H / 2);
      return;
    }

    const zoom = viewZoomRef.current;
    const totalPoints = displayPackets.length;
    const visibleCount = Math.max(5, Math.floor(totalPoints / zoom));
    const offset = Math.min(viewOffsetRef.current, totalPoints - visibleCount);
    const startIdx = Math.max(0, totalPoints - visibleCount - offset);
    const endIdx = Math.min(totalPoints, startIdx + visibleCount);
    const visible = displayPackets.slice(startIdx, endIdx);

    if (visible.length < 2) return;

    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const toX = (i: number) => PAD_L + (i / (visible.length - 1)) * chartW;

    const drawChannel = (ch: ChannelName, yAxis: 'left' | 'right') => {
      const vals = visible.map(p => p[ch] as number);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const toY = (v: number) => PAD_T + chartH - ((v - minV) / range) * chartH;
      const color = CHANNEL_COLORS[ch];

      // Classification background bands
      for (let i = 0; i < visible.length - 1; i++) {
        const ts = visible[i].timestamp;
        const active = [...classificationHistory].reverse().find(c => c.timestamp <= ts);
        if (active && active.label !== 'Optimal') {
          const bandColor = CLASSIFICATION_COLORS[active.label] + '18';
          ctx.fillStyle = bandColor;
          ctx.fillRect(toX(i), PAD_T, toX(i + 1) - toX(i), chartH);
        }
      }

      // Line
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < vals.length; i++) {
        ctx.lineTo(toX(i), toY(vals[i]));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = color;
      ctx.font = '10px JetBrains Mono, monospace';
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

    // X-axis time labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const t0 = visible[0].timestamp;
    const t1 = visible[visible.length - 1].timestamp;
    const fmtSec = (ts: number) => {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    };
    ctx.fillText(fmtSec(t0), PAD_L, H - 4);
    ctx.fillText(fmtSec(t1), W - PAD_R, H - 4);

    // Axis border
    ctx.strokeStyle = '#2a3441';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, H - PAD_B);
    ctx.lineTo(W - PAD_R, H - PAD_B);
    ctx.stroke();
  }, [packets, classificationHistory, ch1, ch2, viewMode]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse handlers
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
    const dx = dragStartRef.current.x - e.clientX;
    const totalPoints = (viewMode === '5min' ? Math.min(packets.length, 150) : packets.length);
    const visibleCount = Math.max(5, Math.floor(totalPoints / viewZoomRef.current));
    const pxPerSample = (W - PAD_L - PAD_R) / visibleCount;
    const delta = Math.round(dx / pxPerSample);
    viewOffsetRef.current = Math.max(0, Math.min(totalPoints - visibleCount, dragStartRef.current.offset + delta));
    draw();
  }, [draw, packets.length, viewMode]);

  const handleMouseUp = useCallback(() => { dragStartRef.current = null; }, []);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const handleMouseMoveTooltip = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current) { handleMouseMove(e); return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const displayPackets = viewMode === '5min' ? packets.slice(-150) : packets;
    const totalPoints = displayPackets.length;
    if (totalPoints < 2) return;
    const visibleCount = Math.max(5, Math.floor(totalPoints / viewZoomRef.current));
    const offset = Math.min(viewOffsetRef.current, totalPoints - visibleCount);
    const startIdx = Math.max(0, totalPoints - visibleCount - offset);
    const endIdx = Math.min(totalPoints, startIdx + visibleCount);
    const visible = displayPackets.slice(startIdx, endIdx);
    const chartW = W - PAD_L - PAD_R;
    const idx = Math.round(((mx - PAD_L) / chartW) * (visible.length - 1));
    if (idx < 0 || idx >= visible.length) { setTooltip(null); return; }
    const p = visible[idx];
    const ts = new Date(p.timestamp);
    const activeClass = [...classificationHistory].reverse().find(c => c.timestamp <= p.timestamp);
    const content = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}  ${CHANNEL_LABELS[ch1]}: ${(p[ch1] as number).toFixed(2)} | ${CHANNEL_LABELS[ch2]}: ${(p[ch2] as number).toFixed(2)}  [${activeClass?.label ?? 'Optimal'}]`;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content });
  }, [packets, classificationHistory, ch1, ch2, viewMode, handleMouseMove]);

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Historical Charts</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="select" value={ch1} onChange={e => setCh1(e.target.value as ChannelName)}>
            {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>)}
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>vs</span>
          <select className="select" value={ch2} onChange={e => setCh2(e.target.value as ChannelName)}>
            {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>)}
          </select>
          <button
            className={`btn ${viewMode === '5min' ? 'btn-green' : ''}`}
            onClick={() => setViewMode('5min')}
            style={{ fontSize: 11 }}
          >5 min</button>
          <button
            className={`btn ${viewMode === 'session' ? 'btn-green' : ''}`}
            onClick={() => setViewMode('session')}
            style={{ fontSize: 11 }}
          >Session</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          <span style={{ color: CHANNEL_COLORS[ch1] }}>━</span> {CHANNEL_LABELS[ch1]} ({CHANNEL_UNITS[ch1]})
          {ch2 !== ch1 && <> &nbsp; <span style={{ color: CHANNEL_COLORS[ch2] }}>━</span> {CHANNEL_LABELS[ch2]} ({CHANNEL_UNITS[ch2]})</>}
        </div>
      </div>

      <div style={{ position: 'relative', cursor: 'crosshair', userSelect: 'none' }}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveTooltip}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
          style={{ display: 'block', maxWidth: '100%' }}
        />
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 10, W - 300),
            top: tooltip.y - 30,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            {tooltip.content}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
        scroll to zoom · drag to pan
      </div>
    </div>
  );
};
