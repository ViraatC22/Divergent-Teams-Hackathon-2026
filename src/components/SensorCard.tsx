import React, { memo } from 'react';
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
  altitude:     '#3b82f6',
  temperature:  '#f97316',
  pressure:     '#8b5cf6',
  soilPercent:  '#10b981',
  vibrationRMS: '#f59e0b',
};

export const SensorCard: React.FC<Props> = memo(({ channel, state, currentValue, pressureDelta }) => {
  const color     = CHANNEL_COLORS[channel];
  const label     = CHANNEL_LABELS[channel];
  const unit      = CHANNEL_UNITS[channel];
  const showDot   = isDotVisible(state);
  const rate      = anomalyRate(state);
  const isAnomalous = showDot;

  const displayValue = currentValue !== null && currentValue !== undefined
    ? channel === 'soilPercent'  ? currentValue.toFixed(0)
    : channel === 'pressure'     ? currentValue.toFixed(1)
    : channel === 'vibrationRMS' ? currentValue.toFixed(2)
    : currentValue.toFixed(1)
    : '—';

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {isAnomalous && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              anomaly
            </Badge>
          )}
        </div>

        {/* Primary value */}
        <div className="mb-1 flex items-baseline gap-1.5">
          <span
            className="font-mono text-2xl font-bold leading-none"
            style={{ color: currentValue !== null ? color : undefined }}
          >
            {displayValue}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
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
