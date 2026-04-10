import type { ChannelName } from '../types';
import { CHANNELS } from '../types';
import { pearson } from '../utils/stats';

const insightTemplates: Record<string, string> = {
  'temperature_soilPercent':  'Soil dryness correlated with temperature',
  'temperature_pressure':     'Pressure shifts tracking temperature change',
  'altitude_pressure':        'Altitude inversely tracks barometric pressure',
  'soilPercent_pressure':     'Soil moisture linked to barometric changes',
  'soilPercent_vibrationRMS': 'Ground disturbance affecting moisture readings',
  'altitude_temperature':     'Temperature variation with altitude change',
  'altitude_soilPercent':     'Soil conditions vary with terrain elevation',
  'pressure_vibrationRMS':    'Vibration linked to pressure changes',
  'temperature_vibrationRMS': 'Temperature shifts coincide with vibration',
  'altitude_vibrationRMS':    'Terrain elevation correlates with ground vibration',
};

export function computeCorrelationMatrix(buffers: Record<ChannelName, number[]>): number[][] {
  const n = CHANNELS.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const r = pearson(buffers[CHANNELS[i]], buffers[CHANNELS[j]]);
        matrix[i][j] = r;
        matrix[j][i] = r;
      }
    }
  }

  return matrix;
}

export function generateInsights(matrix: number[][]): string[] {
  const insights: string[] = [];
  const n = CHANNELS.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = matrix[i][j];
      if (Math.abs(r) > 0.7) {
        const key = [CHANNELS[i], CHANNELS[j]].sort().join('_');
        const template = insightTemplates[key];
        if (template) {
          const direction = r > 0 ? 'positively' : 'inversely';
          insights.push(`${template} — ${direction} (r = ${r.toFixed(2)})`);
        }
      }
    }
  }

  return insights;
}

/** Map r ∈ [-1, 1] to a muted dark-theme color: blue tint(-1) → neutral(0) → amber tint(+1) */
export function correlationColor(r: number): string {
  const base = 19; // neutral dark cell (~#131313)
  if (r < 0) {
    // neutral → blue tint
    const intensity = Math.abs(r);
    const rCh = Math.round(base + (30  - base) * intensity);
    const gCh = Math.round(base + (40  - base) * intensity);
    const bCh = Math.round(base + (110 - base) * intensity);
    return `rgb(${rCh},${gCh},${bCh})`;
  } else {
    // neutral → amber tint
    const intensity = r;
    const rCh = Math.round(base + (110 - base) * intensity);
    const gCh = Math.round(base + (70  - base) * intensity);
    const bCh = Math.round(base + (20  - base) * intensity);
    return `rgb(${rCh},${gCh},${bCh})`;
  }
}
