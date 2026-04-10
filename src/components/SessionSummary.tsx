import React from 'react';
import type { ClassificationLabel, ChannelName, ChannelState, ClassificationEntry, SensorPacket } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS as CH_LABELS } from '../config';
import { formatDuration } from '../utils/formatters';
import { exportJSON, exportCSV } from '../utils/export';
import { DonutChart } from './DonutChart';

interface Props {
  sessionStart: number;
  totalPackets: number;
  channelStates: Record<ChannelName, ChannelState>;
  sessionClassificationCounts: Record<ClassificationLabel, number>;
  classificationLog: ClassificationEntry[];
  allPackets: SensorPacket[];
  correlationInsights: string[];
}

export const SessionSummary: React.FC<Props> = ({
  sessionStart,
  totalPackets,
  channelStates,
  sessionClassificationCounts,
  classificationLog,
  allPackets,
  correlationInsights,
}) => {
  const elapsed = Date.now() - sessionStart;

  // Top finding: highest |r| insight or a crossing warning
  const topFinding = correlationInsights[0] ?? 'No significant patterns detected yet.';

  // Max anomaly channel
  const maxAnomalyChannel = CHANNELS.reduce((best, ch) =>
    channelStates[ch].anomalyCount > channelStates[best].anomalyCount ? ch : best
  , CHANNELS[0]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="section-title">Session Summary</div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Duration</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
            {formatDuration(elapsed)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Data Points</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
            {totalPackets.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Classifications</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
            {classificationLog.length}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {/* Time-in-state donut */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Time in State
          </div>
          <DonutChart counts={sessionClassificationCounts} />
        </div>

        {/* Anomaly counts */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Anomaly Count by Channel
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHANNELS.map(ch => {
              const count = channelStates[ch].anomalyCount;
              const maxCount = Math.max(1, ...CHANNELS.map(c => channelStates[c].anomalyCount));
              const pct = (count / maxCount) * 100;
              return (
                <div key={ch}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{CH_LABELS[ch]}</span>
                    <span className="font-mono" style={{ color: count > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: count > 0 ? '#f59e0b' : '#2a3441', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top finding */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Top Finding
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
          <span style={{ color: '#22c55e', marginRight: 6 }}>▸</span>
          {topFinding}
        </div>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-green" onClick={() => exportJSON(allPackets, classificationLog)}>
          ↓ Export JSON
        </button>
        <button className="btn" onClick={() => exportCSV(allPackets)}>
          ↓ Export CSV
        </button>
      </div>
    </div>
  );
};
