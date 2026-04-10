import type { ForecastResult } from '../types';
import { ols } from '../utils/stats';

const FORECAST_STEPS_15MIN = 450; // 15 min at 2s per sample
const FORECAST_STEPS_30MIN = 900; // 30 min

const criticalThresholds = {
  temperature: 40,
  soilPercent: 15,
} as const;

export function computeForecast(
  channel: 'temperature' | 'soilPercent',
  buffer: number[]
): ForecastResult | null {
  if (buffer.length < 10) return null;

  const { slope, intercept, stdError } = ols(buffer);
  const n = buffer.length;

  // Project 30 minutes forward
  const projectedValues: number[] = [];
  for (let t = 1; t <= FORECAST_STEPS_30MIN; t++) {
    projectedValues.push(intercept + slope * (n - 1 + t));
  }

  // Find threshold crossing within 30 min
  const threshold = criticalThresholds[channel];
  let thresholdCrossingMinutes: number | null = null;

  for (let t = 0; t < projectedValues.length; t++) {
    const val = projectedValues[t];
    const crossed =
      channel === 'temperature' ? val >= threshold : val <= threshold;

    if (crossed) {
      thresholdCrossingMinutes = Math.round(((t + 1) * 2) / 60 * 10) / 10;
      break;
    }
  }

  return {
    channel,
    historicalValues: buffer.slice(),
    projectedValues: projectedValues.slice(0, FORECAST_STEPS_30MIN),
    slope,
    intercept,
    stdError,
    thresholdCrossingMinutes,
    criticalThreshold: threshold,
  };
}
