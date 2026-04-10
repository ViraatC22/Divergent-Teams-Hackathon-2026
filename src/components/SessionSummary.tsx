import React from 'react';
import { Download } from 'lucide-react';
import type { ClassificationLabel, ChannelName, ChannelState, ClassificationEntry, SensorPacket } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { formatDuration } from '../utils/formatters';
import { exportJSON, exportCSV } from '../utils/export';
import { DonutChart } from './DonutChart';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface Props {
  sessionStart:                number;
  totalPackets:                number;
  channelStates:               Record<ChannelName, ChannelState>;
  sessionClassificationCounts: Record<ClassificationLabel, number>;
  classificationLog:           ClassificationEntry[];
  allPackets:                  SensorPacket[];
  correlationInsights:         string[];
}

export const SessionSummary: React.FC<Props> = ({
  sessionStart, totalPackets, channelStates,
  sessionClassificationCounts, classificationLog, allPackets, correlationInsights,
}) => {
  const elapsed    = Date.now() - sessionStart;
  const topFinding = correlationInsights[0] ?? 'No significant patterns detected yet.';

  const maxAnomalyCount = Math.max(1, ...CHANNELS.map(ch => channelStates[ch].anomalyCount));

  const stats = [
    { label: 'Duration',        value: formatDuration(elapsed) },
    { label: 'Readings',        value: totalPackets.toLocaleString() },
    { label: 'Classifications', value: classificationLog.length.toString() },
  ];

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm">Session Summary</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 flex flex-col gap-5">

        {/* Stat row */}
        <div className="flex gap-8 flex-wrap">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="font-mono text-xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Donut chart */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Time in State</p>
            <DonutChart counts={sessionClassificationCounts} />
          </div>

          {/* Anomaly bars */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Anomalies by Channel
            </p>
            <div className="flex flex-col gap-3">
              {CHANNELS.map(ch => {
                const count = channelStates[ch].anomalyCount;
                const pct   = (count / maxAnomalyCount) * 100;
                return (
                  <div key={ch}>
                    <div className="flex justify-between mb-1 text-xs">
                      <span className="text-muted-foreground">{CHANNEL_LABELS[ch]}</span>
                      <span className={cn('font-mono', count > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', count > 0 ? 'bg-amber-400' : 'bg-border')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top finding */}
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Top Finding</p>
          <p className="text-sm text-foreground leading-relaxed">
            <span className="mr-1.5 text-emerald-400">›</span>
            {topFinding}
          </p>
        </div>

        {/* Export */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => exportJSON(allPackets, classificationLog)}>
            <Download size={12} /> JSON
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => exportCSV(allPackets)}>
            <Download size={12} /> CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
