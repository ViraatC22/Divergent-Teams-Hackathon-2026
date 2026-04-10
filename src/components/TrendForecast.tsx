import React, { useRef, useEffect } from 'react';
import type { ForecastResult } from '../types';

interface Props {
  forecast: ForecastResult | null;
  label: string;
  color: string;
  unit: string;
}

const CHART_H = 140;
const CHART_W = 480;

export const TrendForecast: React.FC<Props> = ({ forecast, label, color, unit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !forecast) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = CHART_W;
    const H = CHART_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const hist = forecast.historicalValues;
    const proj = forecast.projectedValues;
    // Show last 150 historical + first 450 projected (15 min)
    const displayProj = proj.slice(0, 450);
    const totalPoints = hist.length + displayProj.length;

    const allValues = [...hist, ...displayProj];
    // Include threshold in range
    const threshold = forecast.criticalThreshold;
    const minV = Math.min(...allValues, threshold) - 2;
    const maxV = Math.max(...allValues, threshold) + 2;
    const range = maxV - minV || 1;

    const toX = (i: number) => (i / (totalPoints - 1)) * W;
    const toY = (v: number) => H - ((v - minV) / range) * (H - 8) - 4;

    // Confidence band for projected
    if (forecast.stdError > 0 && displayProj.length > 0) {
      ctx.beginPath();
      for (let i = 0; i < displayProj.length; i++) {
        const x = toX(hist.length + i);
        const y = toY(displayProj[i] + forecast.stdError);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let i = displayProj.length - 1; i >= 0; i--) {
        ctx.lineTo(toX(hist.length + i), toY(displayProj[i] - forecast.stdError));
      }
      ctx.closePath();
      ctx.fillStyle = color + '22';
      ctx.fill();
    }

    // Critical threshold line
    const threshY = toY(threshold);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(W, threshY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Historical solid line
    if (hist.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(hist[0]));
      for (let i = 1; i < hist.length; i++) {
        ctx.lineTo(toX(i), toY(hist[i]));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Projected dashed line
    if (displayProj.length > 0) {
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(hist.length - 1), toY(hist[hist.length - 1]));
      for (let i = 0; i < displayProj.length; i++) {
        ctx.lineTo(toX(hist.length + i), toY(displayProj[i]));
      }
      ctx.strokeStyle = color + 'aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${maxV.toFixed(0)}${unit}`, 2, 12);
    ctx.fillText(`${minV.toFixed(0)}${unit}`, 2, H - 4);

    // Divider line: historical vs projected
    if (hist.length > 0) {
      const divX = toX(hist.length - 1);
      ctx.beginPath();
      ctx.moveTo(divX, 0);
      ctx.lineTo(divX, H);
      ctx.strokeStyle = '#2a3441';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X-axis labels
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('now', toX(hist.length - 1), H - 2);
    ctx.fillText('+15m', toX(hist.length + 225), H - 2);
  }, [forecast, color, unit]);

  if (!forecast) {
    return (
      <div className="card-elevated" style={{ height: CHART_H + 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Collecting data… (need 10+ samples)</span>
      </div>
    );
  }

  return (
    <div className="card-elevated">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          slope: {forecast.slope > 0 ? '+' : ''}{(forecast.slope * 30).toFixed(2)}{unit}/min
        </span>
      </div>

      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', maxWidth: CHART_W }} />

      {forecast.thresholdCrossingMinutes !== null && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 4,
          fontSize: 12,
          color: '#ef4444',
          fontWeight: 500,
        }}>
          ⚠ {label} projected to reach critical{' '}
          {forecast.channel === 'temperature' ? 'high' : 'low'} in ~{forecast.thresholdCrossingMinutes} minutes
        </div>
      )}
    </div>
  );
};
