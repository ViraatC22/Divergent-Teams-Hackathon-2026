import React, { useState } from 'react';
import { Wifi, WifiOff, Loader2, Pencil, Check, X } from 'lucide-react';
import type { ConnectionStatus, ClassificationResult } from '../types';
import { CLASSIFICATION_COLORS } from '../config';
import { formatTimeAgo } from '../utils/formatters';
import { healthColor } from '../engine/healthScore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';

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
  connectionStatus, wsUrl, onWsUrlChange, onConnect,
  simulationMode, onToggleSimulation,
  lastPacketTime, isStale, healthScore, classification,
}) => {
  const [editing, setEditing]   = useState(false);
  const [editUrl, setEditUrl]   = useState(wsUrl);

  const isConnected    = connectionStatus === 'connected';
  const isReconnecting = connectionStatus === 'reconnecting';

  const statusText =
    isConnected    ? (simulationMode ? 'Simulation' : 'Live') :
    isReconnecting ? 'Reconnecting' :
    'Offline';

  const dataText =
    lastPacketTime === 0 ? 'Awaiting reading…' :
    isStale              ? `Awaiting reading · last ${formatTimeAgo(lastPacketTime)}` :
                           formatTimeAgo(lastPacketTime);

  const hColor = healthColor(healthScore);
  const cColor = CLASSIFICATION_COLORS[classification.label];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onWsUrlChange(editUrl);
    setEditing(false);
    onConnect();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-5">
      {/* Brand */}
      <span className="text-sm font-semibold tracking-tight text-foreground">AgriSwarm</span>
      <span className="text-xs text-muted-foreground">Field Monitor</span>

      <Separator orientation="vertical" className="h-5" />

      {/* Connection status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi size={14} className={simulationMode ? 'text-amber-400' : 'text-emerald-400'} />
        ) : isReconnecting ? (
          <Loader2 size={14} className="text-amber-400 conn-blink" />
        ) : (
          <WifiOff size={14} className="text-muted-foreground" />
        )}
        <span className={cn(
          'text-xs font-medium',
          isConnected    ? (simulationMode ? 'text-amber-400' : 'text-emerald-400') :
          isReconnecting ? 'text-amber-400' :
          'text-muted-foreground',
        )}>
          {statusText}
        </span>
      </div>

      {/* URL editor */}
      {!simulationMode && (
        editing ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              className="h-7 w-56 text-xs"
              autoFocus
            />
            <Button type="submit" size="icon" variant="ghost" className="h-7 w-7">
              <Check size={13} />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
              <X size={13} />
            </Button>
          </form>
        ) : (
          <button
            onClick={() => { setEditUrl(wsUrl); setEditing(true); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            {wsUrl}
            <Pencil size={11} />
          </button>
        )
      )}

      {/* Data freshness */}
      <span className="text-xs text-muted-foreground font-mono">{dataText}</span>

      <div className="flex-1" />

      {/* Health score */}
      <div className="flex items-baseline gap-1">
        <span className="text-xs text-muted-foreground">Health</span>
        <span className="font-mono text-lg font-bold" style={{ color: hColor }}>{healthScore}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Classification */}
      <div className="flex flex-col items-end">
        <span className="text-xs font-semibold" style={{ color: cColor }}>{classification.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {(classification.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Simulate toggle */}
      <Button
        size="sm"
        variant={simulationMode ? 'secondary' : 'default'}
        onClick={onToggleSimulation}
        className="text-xs"
      >
        {simulationMode ? 'Stop Sim' : 'Simulate'}
      </Button>
    </header>
  );
};
