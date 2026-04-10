import React from 'react';
import type { ChannelName, ChannelState } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { anomalyRate } from '../engine/anomaly';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '../lib/utils';

interface Props {
  channelStates: Record<ChannelName, ChannelState>;
}

export const AnomalySummary: React.FC<Props> = ({ channelStates }) => (
  <Card>
    <CardHeader className="pb-3 pt-4 px-4">
      <CardTitle className="text-sm">Anomaly Detection</CardTitle>
    </CardHeader>
    <CardContent className="px-4 pb-4 pt-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Z-Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Rate/min</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CHANNELS.map(ch => {
            const s    = channelStates[ch];
            const rate = anomalyRate(s);
            return (
              <TableRow key={ch}>
                <TableCell className="font-sans text-xs font-medium text-foreground">
                  {CHANNEL_LABELS[ch]}
                </TableCell>
                <TableCell className={cn('text-right', Math.abs(s.zScore) > 2 ? 'text-red-400' : 'text-muted-foreground')}>
                  {s.zScore.toFixed(2)}
                </TableCell>
                <TableCell>
                  {s.isAnomalous
                    ? <Badge variant="destructive" className="text-[10px]">Anomalous</Badge>
                    : <Badge variant="success"     className="text-[10px]">Normal</Badge>
                  }
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{s.anomalyCount}</TableCell>
                <TableCell className={cn('text-right', rate > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                  {rate.toFixed(1)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
