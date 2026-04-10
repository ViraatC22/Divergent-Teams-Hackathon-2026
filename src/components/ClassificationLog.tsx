import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { ClassificationEntry, ClassificationLabel } from '../types';
import { CLASSIFICATION_COLORS } from '../config';
import { formatTimestamp } from '../utils/formatters';
import { exportClassificationCSV } from '../utils/export';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface Props { log: ClassificationEntry[]; }

const FILTER_OPTIONS: (ClassificationLabel | 'All')[] = [
  'All', 'Optimal', 'Drought Risk', 'Pest Alert', 'Terrain Warning',
];

export const ClassificationLog: React.FC<Props> = ({ log }) => {
  const [filter, setFilter] = useState<ClassificationLabel | 'All'>('All');
  const display = (filter === 'All' ? log : log.filter(e => e.label === filter)).slice(0, 50);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm">Classification Log</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as ClassificationLabel | 'All')}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {FILTER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => exportClassificationCSV(log)}>
              <Download size={12} /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Conf</TableHead>
              <TableHead>Triggers</TableHead>
              <TableHead>Key Values</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground italic font-sans">
                  No classifications recorded yet
                </TableCell>
              </TableRow>
            ) : display.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatTimestamp(entry.timestamp)}</TableCell>
                <TableCell>
                  <span className="font-sans text-xs font-semibold" style={{ color: CLASSIFICATION_COLORS[entry.label] }}>
                    {entry.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{(entry.confidence * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-muted-foreground">{entry.triggers.join(', ') || '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {Object.entries(entry.keyValues).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
