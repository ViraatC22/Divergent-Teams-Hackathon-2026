import React from 'react';
import type { ChannelName, ChannelState } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS as CH_LABELS } from '../config';
import { anomalyRate } from '../engine/anomaly';

interface Props {
  channelStates: Record<ChannelName, ChannelState>;
}

export const AnomalySummary: React.FC<Props> = ({ channelStates }) => {
  return (
    <div className="card">
      <div className="section-title">Anomaly Detection</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Z-Score</th>
            <th>Status</th>
            <th>Total</th>
            <th>Rate/min</th>
          </tr>
        </thead>
        <tbody>
          {CHANNELS.map(ch => {
            const s = channelStates[ch];
            const rate = anomalyRate(s);
            const isAnom = s.isAnomalous;
            return (
              <tr key={ch}>
                <td style={{ color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                  {CH_LABELS[ch]}
                </td>
                <td style={{ color: Math.abs(s.zScore) > 2 ? '#ef4444' : 'var(--text-muted)' }}>
                  {s.zScore.toFixed(2)}
                </td>
                <td>
                  {isAnom
                    ? <span className="badge badge-critical">Anomalous</span>
                    : <span className="badge badge-ok">Normal</span>
                  }
                </td>
                <td>{s.anomalyCount}</td>
                <td style={{ color: rate > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                  {rate.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
