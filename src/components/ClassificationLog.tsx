import React, { useState } from 'react';
import type { ClassificationEntry, ClassificationLabel } from '../types';
import { CLASSIFICATION_COLORS } from '../config';
import { formatTimestamp } from '../utils/formatters';
import { exportClassificationCSV } from '../utils/export';

interface Props {
  log: ClassificationEntry[];
}

const FILTER_OPTIONS: (ClassificationLabel | 'All')[] = ['All', 'Optimal', 'Drought Risk', 'Pest Alert', 'Terrain Warning'];

export const ClassificationLog: React.FC<Props> = ({ log }) => {
  const [filter, setFilter] = useState<ClassificationLabel | 'All'>('All');

  const filtered = filter === 'All' ? log : log.filter(e => e.label === filter);
  const display = filtered.slice(0, 50); // cap for perf

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Stress Classification Log</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="select"
            value={filter}
            onChange={e => setFilter(e.target.value as ClassificationLabel | 'All')}
          >
            {FILTER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button className="btn" onClick={() => exportClassificationCSV(log)}>
            ↓ CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 500 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Label</th>
              <th>Conf</th>
              <th>Triggers</th>
              <th>Key Values</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                  No classifications recorded yet
                </td>
              </tr>
            )}
            {display.map(entry => (
              <tr key={entry.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(entry.timestamp)}</td>
                <td>
                  <span style={{
                    color: CLASSIFICATION_COLORS[entry.label],
                    fontWeight: 600,
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                  }}>
                    {entry.label}
                  </span>
                </td>
                <td>{(entry.confidence * 100).toFixed(0)}%</td>
                <td style={{ fontSize: 11, color: '#94a3b8' }}>{entry.triggers.join(', ') || '—'}</td>
                <td style={{ fontSize: 11, color: '#94a3b8' }}>
                  {Object.entries(entry.keyValues).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
