import React, { useRef, useEffect, memo } from 'react';
import gsap from 'gsap';
import type { ChannelName, ChannelState } from '../types';
import { CHANNEL_LABELS, CHANNEL_UNITS } from '../config';
import { isDotVisible, anomalyRate } from '../engine/anomaly';
import { Sparkline } from './Sparkline';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface Props {
  channel: ChannelName;
  state: ChannelState;
  currentValue: number | null;
  pressureDelta?: number | null;
}

const CHANNEL_COLORS: Record<ChannelName, string> = {
  altitude:     '#3b82f6',   // blue
  temperature:  '#f97316',   // orange
  pressure:     '#8b5cf6',   // violet
  soilPercent:  '#10b981',   // emerald
  vibrationRMS: '#f59e0b',   // amber
};

function formatValue(channel: ChannelName, v: number): string {
  switch (channel) {
    case 'soilPercent':  return v.toFixed(0);
    case 'pressure':     return v.toFixed(1);
    case 'vibrationRMS': return v.toFixed(2);
    default:             return v.toFixed(1);
  }
}

export const SensorCard: React.FC<Props> = memo(({ channel, state, currentValue, pressureDelta }) => {
  const color      = CHANNEL_COLORS[channel];
  const label      = CHANNEL_LABELS[channel];
  const unit       = CHANNEL_UNITS[channel];
  const isAnomalous = isDotVisible(state);
  const rate       = anomalyRate(state);

  // Determine status tier for left-border class
  const statusClass =
    isAnomalous              ? 'sensor-card--anomalous' :
    Math.abs(state.zScore) > 1.5 ? 'sensor-card--warning' :
    'sensor-card--nominal';

  // ── GSAP refs ────────────────────────────────────────────────────────────
  const cardRef     = useRef<HTMLDivElement>(null);
  const valueSpanRef = useRef<HTMLSpanElement>(null);
  const tweenProxy  = useRef<{ value: number }>({ value: currentValue ?? 0 });
  const prevAnomalousRef = useRef(false);
  const prevValueRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // ── Number tweening on data arrival ──────────────────────────────────────
  useEffect(() => {
    if (currentValue === null) return;
    const el = valueSpanRef.current;
    if (!el) return;

    // On first render, just set text directly — no tween
    if (isFirstRender.current) {
      el.textContent = formatValue(channel, currentValue);
      tweenProxy.current.value = currentValue;
      prevValueRef.current = currentValue;
      isFirstRender.current = false;
      return;
    }

    const proxy = tweenProxy.current;
    gsap.killTweensOf(proxy);
    gsap.to(proxy, {
      value: currentValue,
      duration: 0.3,
      ease: 'power1.out',
      snap: { value: channel === 'soilPercent' ? 1 : 0.1 },
      onUpdate: () => {
        if (el) el.textContent = formatValue(channel, proxy.value);
      },
    });

    prevValueRef.current = currentValue;
    return () => { gsap.killTweensOf(proxy); };
  }, [currentValue, channel]);

  // ── Anomaly pulse / glow ─────────────────────────────────────────────────
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const wasAnomalous = prevAnomalousRef.current;

    if (isAnomalous && !wasAnomalous) {
      // Just became anomalous — pulse 3×
      gsap.killTweensOf(card);
      gsap.to(card, {
        boxShadow: '0 0 24px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
        duration: 0.25,
        yoyo: true,
        repeat: 5,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.to(card, {
            boxShadow: '0 0 14px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.07)',
            duration: 0.5,
          });
        },
      });
    } else if (!isAnomalous && wasAnomalous) {
      gsap.killTweensOf(card);
      gsap.to(card, {
        boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
        duration: 0.6,
        ease: 'power2.out',
      });
    }

    prevAnomalousRef.current = isAnomalous;
    return () => { gsap.killTweensOf(card); };
  }, [isAnomalous]);

  const displayFallback = currentValue === null ? '—' : formatValue(channel, currentValue);

  return (
    <Card ref={cardRef} className={cn('sensor-card', statusClass)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          {isAnomalous && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              anomaly
            </Badge>
          )}
        </div>

        {/* Primary value — large, dominant */}
        <div className="mb-1 flex items-baseline gap-1.5">
          <span
            ref={valueSpanRef}
            className="font-mono font-bold leading-none"
            style={{
              color: currentValue !== null ? color : undefined,
              fontSize: '2rem',
              lineHeight: 1,
            }}
          >
            {displayFallback}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>

        {/* Sub-info */}
        <div className="mb-3 min-h-[16px] text-xs text-muted-foreground font-mono">
          {channel === 'pressure' && pressureDelta !== null && pressureDelta !== undefined && (
            <span className={pressureDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {pressureDelta >= 0 ? '+' : ''}{pressureDelta.toFixed(2)} hPa/min
            </span>
          )}
          {channel === 'soilPercent' && currentValue !== null && (() => {
            const pct = currentValue as number;
            const barColor = pct < 15 ? '#ef4444' : pct < 25 ? '#f59e0b' : '#10b981';
            return (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded bg-border overflow-hidden">
                  <div style={{ width: `${Math.min(pct, 100)}%`, background: barColor, height: '100%', transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sparkline */}
        <Sparkline data={state.buffer} color={color} height={40} />

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>
            z = <span className={cn(Math.abs(state.zScore) > 2 ? 'text-red-400' : 'text-muted-foreground')}>
              {state.zScore.toFixed(2)}
            </span>
          </span>
          {rate > 0 ? (
            <span className="text-amber-400">{rate}/min</span>
          ) : (
            <span>nominal</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

SensorCard.displayName = 'SensorCard';
