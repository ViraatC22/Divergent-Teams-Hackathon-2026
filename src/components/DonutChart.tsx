import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
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
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const progressRef   = useRef<{ t: number }>({ t: 0 });
  const totalRef      = useRef(0);
  const countsRef     = useRef(counts);
  countsRef.current   = counts;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const drawFrame = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, SIZE * dpr, SIZE * dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const currentCounts = countsRef.current;
    const currentTotal  = Object.values(currentCounts).reduce((a, b) => a + b, 0);

    if (currentTotal === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = RADIUS - INNER;
      ctx.stroke();
    } else {
      // Draw arcs up to t (0→1 drives the sweep)
      let startAngle = -Math.PI / 2;
      const fullSweep = Math.PI * 2 * t;
      let drawn = 0;

      for (const label of ORDER) {
        const count = currentCounts[label];
        if (count === 0) continue;
        const slice    = (count / currentTotal) * Math.PI * 2;
        const thisSlice = Math.min(slice, Math.max(0, fullSweep - drawn));
        const endAngle  = startAngle + thisSlice;

        if (thisSlice > 0.001) {
          ctx.beginPath();
          ctx.arc(cx, cy, RADIUS, startAngle, endAngle);
          ctx.arc(cx, cy, INNER, endAngle, startAngle, true);
          ctx.closePath();
          ctx.fillStyle = CLASSIFICATION_COLORS[label] + 'cc';
          ctx.fill();

          // Gap line
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(endAngle) * INNER,  cy + Math.sin(endAngle) * INNER);
          ctx.lineTo(cx + Math.cos(endAngle) * RADIUS, cy + Math.sin(endAngle) * RADIUS);
          ctx.strokeStyle = '#131316';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        drawn += slice;
        startAngle += slice;
        if (drawn >= fullSweep) break;
      }
    }

    // Center total
    ctx.fillStyle     = '#a1a1aa';
    ctx.font          = 'bold 13px JetBrains Mono, monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(`${currentTotal}`, cx, cy);
  };

  // Setup canvas DPR once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Animate when counts change (or on first render)
  useEffect(() => {
    if (total === 0) {
      drawFrame(1);
      return;
    }

    const proxy = progressRef.current;
    gsap.killTweensOf(proxy);
    proxy.t = totalRef.current === 0 ? 0 : 0.85; // if first time start from 0, otherwise from near end
    totalRef.current = total;

    gsap.to(proxy, {
      t: 1,
      duration: totalRef.current === total ? 0.15 : 0.8, // short redraw vs full draw
      ease: 'power2.out',
      onUpdate: () => drawFrame(proxy.t),
    });

    return () => { gsap.killTweensOf(proxy); };
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

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
