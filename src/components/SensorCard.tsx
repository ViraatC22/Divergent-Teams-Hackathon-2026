import React, { memo } from 'react';
import type { ChannelName, ChannelState } from '../types';
import { CHANNEL_LABELS, CHANNEL_UNITS, CHANNEL_ICONS } from '../config';
import { isDotVisible, anomalyRate } from '../engine/anomaly';
import { Sparkline } from './Sparkline';

interface Props {
  channel: ChannelName;
  state: ChannelState;
  currentValue: number | null;
  pressureDelta?: number | null;
}

const CHANNEL_COLORS: Record<ChannelName, string> = {
  distance: '#3b82f6',
  temperature: '#f97316',
  pressure: '#a78bfa',
  soilPercent: '#22c55e',
  vibrationRMS: '#f59e0b',
};

export const SensorCard: React.FC<Props> = memo(({ channel, state, currentValue, pressureDelta }) => {
  const color = CHANNEL_COLORS[channel];
  const label = CHANNEL_LABELS[channel];
  const unit = CHANNEL_UNITS[channel];
  const icon = CHANNEL_ICONS[channel];
  const showDot = isDotVisible(state);
  const rate = anomalyRate(state);

  const displayValue = currentValue !== null && currentValue !== undefined
    ? channel === 'soilPercent'
      ? currentValue.toFixed(0)
      : channel === 'pressure'
        ? currentValue.toFixed(1)
        : currentValue.toFixed(channel === 'vibrationRMS' ? 2 : 1)
    : '—';

  const sparkBand = channel === 'temperature'
    ? { min: 15, max: 30, color: 'rgba(34,197,94,0.12)' }
    : undefined;

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Anomaly dot */}
      {showDot && (
        <span
          className="anomaly-dot"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ef4444',
            display: 'block',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span className="font-mono" style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
          {displayValue}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{unit}</span>
      </div>

      {/* Extra info */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 10, minHeight: 16 }}>
        {channel === 'pressure' && pressureDelta !== null && pressureDelta !== undefined
          ? <span style={{ color: pressureDelta >= 0 ? '#22c55e' : '#ef4444' }}>
              {pressureDelta >= 0 ? '+' : ''}{pressureDelta.toFixed(2)} hPa/min
            </span>
          : channel === 'pressure'
            ? '—'
            : null
        }
        {channel === 'soilPercent' && currentValue !== null
          ? <span>{currentValue.toFixed(0)}% saturation</span>
          : null
        }
      </div>

      {/* Sparkline */}
      <Sparkline
        data={state.buffer}
        color={color}
        width={180}
        height={48}
        showBand={sparkBand}
      />

      {/* Anomaly rate */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>z = <span className="font-mono" style={{ color: Math.abs(state.zScore) > 2 ? '#ef4444' : 'var(--text-muted)' }}>
          {state.zScore.toFixed(2)}
        </span></span>
        <span className="font-mono">{rate.toFixed(1)}/min</span>
      </div>
    </div>
  );
});

SensorCard.displayName = 'SensorCard';
