import React, { useState } from 'react';
import type { ConnectionStatus, ClassificationResult } from '../types';
import { CLASSIFICATION_COLORS } from '../config';
import { formatTimeAgo } from '../utils/formatters';
import { healthColor } from '../engine/healthScore';

interface Props {
  connectionStatus: ConnectionStatus;
  wsUrl: string;
  onWsUrlChange: (url: string) => void;
  onConnect: () => void;
  simulationMode: boolean;
  onToggleSimulation: () => void;
  lastPacketTime: number;
  isStale: boolean;
  healthScore: number;
  classification: ClassificationResult;
}

export const StatusBar: React.FC<Props> = ({
  connectionStatus,
  wsUrl,
  onWsUrlChange,
  onConnect,
  simulationMode,
  onToggleSimulation,
  lastPacketTime,
  isStale,
  healthScore,
  classification,
}) => {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(wsUrl);

  const dotClass =
    connectionStatus === 'connected' ? 'dot-green' :
    connectionStatus === 'reconnecting' ? 'dot-amber conn-blink' :
    'dot-red';

  const statusLabel =
    connectionStatus === 'connected' ? (simulationMode ? 'SIMULATION' : 'CONNECTED') :
    connectionStatus === 'reconnecting' ? 'RECONNECTING' :
    'DISCONNECTED';

  const hColor = healthColor(healthScore);
  const cColor = CLASSIFICATION_COLORS[classification.label];

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onWsUrlChange(editUrl);
    setEditing(false);
    onConnect();
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexWrap: 'wrap',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', color: '#22c55e' }}>
          AGRISWARM
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>FIELD MONITOR</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`dot ${dotClass}`} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          {statusLabel}
        </span>
      </div>

      {/* WS URL */}
      {!simulationMode && (
        editing ? (
          <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              style={{ width: 200 }}
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-green" style={{ whiteSpace: 'nowrap' }}>Connect</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <button
            className="btn"
            onClick={() => { setEditUrl(wsUrl); setEditing(true); }}
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
          >
            {wsUrl}
          </button>
        )
      )}

      {/* Last data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
        {isStale && <span>⚠️</span>}
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {lastPacketTime > 0 ? formatTimeAgo(lastPacketTime) : '—'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Health Score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>HEALTH</span>
        <span className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: hColor, lineHeight: 1 }}>
          {healthScore}
        </span>
      </div>

      {/* Classification */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: cColor }}>{classification.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {(classification.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      {/* Simulation toggle */}
      <button
        className={`btn ${simulationMode ? 'btn-amber' : ''}`}
        onClick={onToggleSimulation}
        style={{ whiteSpace: 'nowrap' }}
      >
        {simulationMode ? '⏹ Stop Sim' : '▶ Simulate'}
      </button>
    </div>
  );
};
