import type { SensorPacket, ClassificationEntry } from '../types';
import { formatTimestamp } from './formatters';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJSON(packets: SensorPacket[], classifications: ClassificationEntry[]) {
  const data = { packets, classifications, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `agriswarm-session-${Date.now()}.json`);
}

export function exportCSV(packets: SensorPacket[]) {
  const headers = ['timestamp', 'distance', 'temperature', 'pressure', 'soilRaw', 'soilPercent', 'tiltX', 'tiltY', 'vibrationRMS'];
  const rows = packets.map(p => [
    formatTimestamp(p.timestamp),
    p.distance,
    p.temperature,
    p.pressure,
    p.soilRaw,
    p.soilPercent,
    p.tiltX,
    p.tiltY,
    p.vibrationRMS,
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `agriswarm-sensors-${Date.now()}.csv`);
}

export function exportClassificationCSV(log: ClassificationEntry[]) {
  const headers = ['timestamp', 'label', 'confidence', 'triggers', 'keyValues'];
  const rows = log.map(e => [
    formatTimestamp(e.timestamp),
    e.label,
    `${(e.confidence * 100).toFixed(0)}%`,
    e.triggers.join('; '),
    Object.entries(e.keyValues).map(([k, v]) => `${k}=${v}`).join('; '),
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `agriswarm-classifications-${Date.now()}.csv`);
}
