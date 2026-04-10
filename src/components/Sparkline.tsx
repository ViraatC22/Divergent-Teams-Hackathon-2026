import React, { useRef, useEffect } from 'react';
import { SPARKLINE_SAMPLES } from '../config';

interface Props {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  showBand?: { min: number; max: number; color: string };
}

export const Sparkline: React.FC<Props> = ({
  data,
  color,
  width = 200,
  height = 48,
  showBand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayData = data.slice(-SPARKLINE_SAMPLES);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (displayData.length < 2) return;

    const min = Math.min(...displayData);
    const max = Math.max(...displayData);
    const range = max - min || 1;

    const toX = (i: number) => (i / (displayData.length - 1)) * width;
    const toY = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

    // Optional band overlay (e.g., optimal temp range)
    if (showBand) {
      const bandMinY = toY(Math.min(showBand.max, max));
      const bandMaxY = toY(Math.max(showBand.min, min));
      ctx.fillStyle = showBand.color;
      ctx.fillRect(0, bandMinY, width, Math.max(0, bandMaxY - bandMinY));
    }

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(displayData[0]));
    for (let i = 1; i < displayData.length; i++) {
      ctx.lineTo(toX(i), toY(displayData[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Area fill
    ctx.lineTo(toX(displayData.length - 1), height);
    ctx.lineTo(toX(0), height);
    ctx.closePath();
    ctx.fillStyle = color + '18';
    ctx.fill();
  }, [displayData, color, width, height, showBand]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
};
