import type { ChannelName } from '../types';
import { CHANNELS } from '../types';
import { pearson } from '../utils/stats';

const insightTemplates: Record<string, string> = {
  'temperature_soilPercent':  'Soil dryness correlated with temperature',
  'temperature_pressure':     'Pressure shifts tracking temperature change',
  'distance_vibrationRMS':    'Vibration spikes coincide with nearby obstacles',
  'soilPercent_pressure':     'Soil moisture linked to barometric changes',
  'soilPercent_vibrationRMS': 'Ground disturbance affecting moisture readings',
  'distance_temperature':     'Temperature variation near obstructions',
  'distance_pressure':        'Pressure changes near obstacles',
  'distance_soilPercent':     'Soil conditions vary with obstacle proximity',
  'pressure_vibrationRMS':    'Vibration linked to pressure changes',
  'temperature_vibrationRMS': 'Temperature shifts coincide with vibration',
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

/** Map r ∈ [-1, 1] to an RGB color: blue(-1) → white(0) → red(+1) */
export function correlationColor(r: number): string {
  const t = (r + 1) / 2; // 0..1
  if (t < 0.5) {
    // blue to white
    const f = t / 0.5;
    const c = Math.round(255 * f);
    return `rgb(${c},${c},255)`;
  } else {
    // white to red
    const f = (t - 0.5) / 0.5;
    const g = Math.round(255 * (1 - f));
    return `rgb(255,${g},${g})`;
  }
}
