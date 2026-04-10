import React from 'react';
import type { AlertEntry } from '../types';
import { formatTimestamp, formatTimeAgo } from '../utils/formatters';
import { CLASSIFICATION_COLORS } from '../config';

interface Props {
  alerts: AlertEntry[];
}

export const AlertFeed: React.FC<Props> = ({ alerts }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="section-title">Alert Feed</div>

      {alerts.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
          No alerts — system nominal
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
        {alerts.map(alert => {
          const isCritical = alert.severity === 'critical';
          const persisting = Date.now() - alert.persistingSince > 1000;
          const persistSecs = Math.floor((Date.now() - alert.persistingSince) / 1000);

          return (
            <div
              key={alert.id}
              className={isCritical ? 'critical-alert' : ''}
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${isCritical ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 6,
                padding: '10px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className={`badge ${isCritical ? 'badge-critical' : 'badge-warning'}`}>
                  {alert.severity}
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: CLASSIFICATION_COLORS[alert.label],
                }}>
                  {alert.label}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatTimestamp(alert.timestamp)}
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                {alert.recommendation}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Triggers: {alert.triggers.join(' · ')}
                </span>
                {persisting && persistSecs > 30 && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: isCritical ? '#ef4444' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
                    persisting {persistSecs}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
