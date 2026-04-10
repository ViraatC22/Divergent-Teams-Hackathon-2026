import React, { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import type { ForecastResult } from '../types';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  forecast: ForecastResult | null;
  label: string;
  color: string;
  unit: string;
}

const CHART_H = 140;

export const TrendForecast: React.FC<Props> = ({ forecast, label, color, unit }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const projProgress = useRef<{ t: number }>({ t: 0 });
  const forecastRef  = useRef(forecast);
  forecastRef.current = forecast;

  const draw = useCallback((projT = 1) => {
    const canvas = canvasRef.current;
    const fc = forecastRef.current;
    if (!canvas || !fc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W   = canvas.offsetWidth || 480;
    const H   = CHART_H;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const hist        = fc.historicalValues;
    const proj        = fc.projectedValues;
    const displayProj = proj.slice(0, 450);
    const totalPoints = hist.length + displayProj.length;

    const allValues = [...hist, ...displayProj];
    const threshold = fc.criticalThreshold;
    const minV = Math.min(...allValues, threshold) - 2;
    const maxV = Math.max(...allValues, threshold) + 2;
    const range = maxV - minV || 1;

    const toX = (i: number) => (i / (totalPoints - 1)) * W;
    const toY = (v: number) => H - ((v - minV) / range) * (H - 8) - 4;

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0.2; y < 1; y += 0.2) {
      ctx.beginPath();
      ctx.moveTo(0,  H * y);
      ctx.lineTo(W, H * y);
      ctx.stroke();
    }

    // Confidence band (only drawn up to projT progress)
    if (fc.stdError > 0 && displayProj.length > 0) {
      const visibleCount = Math.floor(displayProj.length * projT);

      ctx.beginPath();
      for (let i = 0; i < visibleCount; i++) {
        const x = toX(hist.length + i);
        const y = toY(displayProj[i] + fc.stdError);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let i = visibleCount - 1; i >= 0; i--) {
        ctx.lineTo(toX(hist.length + i), toY(displayProj[i] - fc.stdError));
      }
      ctx.closePath();
      ctx.fillStyle = color + '1a';
      ctx.fill();
    }

    // Threshold line
    const threshY = toY(threshold);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(W, threshY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Historical line — with subtle gradient fill underneath
    if (hist.length > 1) {
      // Gradient fill under the historical line
      const grad = ctx.createLinearGradient(0, toY(maxV), 0, H);
      grad.addColorStop(0, color + '28');
      grad.addColorStop(1, color + '00');
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(hist[0]));
      for (let i = 1; i < hist.length; i++) ctx.lineTo(toX(i), toY(hist[i]));
      ctx.lineTo(toX(hist.length - 1), H);
      ctx.lineTo(toX(0), H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line itself
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(hist[0]));
      for (let i = 1; i < hist.length; i++) ctx.lineTo(toX(i), toY(hist[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      // Data point glow on latest sample
      const lastX = toX(hist.length - 1);
      const lastY = toY(hist[hist.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Projected dashed line — only up to projT
    if (displayProj.length > 0 && projT > 0) {
      const visibleCount = Math.floor(displayProj.length * projT);
      if (visibleCount > 0) {
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(toX(hist.length - 1), toY(hist[hist.length - 1]));
        for (let i = 0; i < visibleCount; i++) {
          ctx.lineTo(toX(hist.length + i), toY(displayProj[i]));
        }
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Axis labels
    ctx.fillStyle   = '#52525b';
    ctx.font        = '10px JetBrains Mono, monospace';
    ctx.textAlign   = 'left';
    ctx.fillText(`${maxV.toFixed(0)}${unit}`, 2, 12);
    ctx.fillText(`${minV.toFixed(0)}${unit}`, 2, H - 4);

    // Divider
    if (hist.length > 0) {
      const divX = toX(hist.length - 1);
      ctx.beginPath();
      ctx.moveTo(divX, 0);
      ctx.lineTo(divX, H);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle  = '#52525b';
    ctx.textAlign  = 'center';
    ctx.fillText('now', toX(hist.length - 1), H - 2);
    ctx.fillText('+15m', toX(hist.length + 225), H - 2);
  }, [color, unit]);

  // Animate the projected line drawing when forecast updates
  useEffect(() => {
    if (!forecast) return;

    const proxy = projProgress.current;
    gsap.killTweensOf(proxy);
    proxy.t = 0;

    // Draw the static part immediately (history + confidence band at t=0 still looks right)
    draw(0);

    // Then animate the projection sweeping in
    gsap.to(proxy, {
      t: 1,
      duration: 1.2,
      ease: 'none',
      onUpdate: () => draw(proxy.t),
    });

    return () => { gsap.killTweensOf(proxy); };
  }, [forecast, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw(projProgress.current.t));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  if (!forecast) {
    return (
      <Card>
        <CardContent
          className="px-4 py-4 flex items-center justify-center"
          style={{ height: CHART_H + 40 }}
        >
          <p className="text-xs text-muted-foreground italic">Collecting data… (need 10+ samples)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm" style={{ color }}>{label}</CardTitle>
          <span className="font-mono text-[10px] text-muted-foreground">
            slope: {forecast.slope > 0 ? '+' : ''}{(forecast.slope * 30).toFixed(2)}{unit}/min
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <canvas ref={canvasRef} className="block w-full" style={{ height: CHART_H }} />

        {forecast.thresholdCrossingMinutes !== null && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
            <AlertTriangle size={12} className="shrink-0 text-red-400" />
            <p className="text-xs text-red-400 font-medium">
              {label} projected to reach critical{' '}
              {forecast.channel === 'temperature' ? 'high' : 'low'} in ~{forecast.thresholdCrossingMinutes} minutes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
