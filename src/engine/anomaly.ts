import { ANOMALY_Z_THRESHOLD, ANOMALY_RATE_WINDOW_MS, ANOMALY_UI_PERSIST_MS } from '../config';
import type { ChannelState } from '../types';
import { zScore } from '../utils/stats';

export function updateChannelAnomaly(state: ChannelState, newValue: number): ChannelState {
  const now = Date.now();
  const newBuffer = state.buffer.slice();
  newBuffer.push(newValue);

  // Need at least 3 points for meaningful z-score
  if (newBuffer.length < 3) {
    return { ...state, buffer: newBuffer, zScore: 0, isAnomalous: false };
  }

  const z = zScore(newValue, newBuffer.slice(0, -1)); // z against previous buffer
  const isAnomalous = Math.abs(z) > ANOMALY_Z_THRESHOLD;

  // Rolling anomaly timestamps (prune older than 60s)
  let timestamps = state.anomalyTimestamps.filter(t => now - t < ANOMALY_RATE_WINDOW_MS);
  if (isAnomalous) {
    timestamps = [...timestamps, now];
  }

  return {
    buffer: newBuffer,
    zScore: z,
    isAnomalous,
    lastAnomalyTime: isAnomalous ? now : state.lastAnomalyTime,
    anomalyCount: isAnomalous ? state.anomalyCount + 1 : state.anomalyCount,
    anomalyTimestamps: timestamps,
  };
}

/** Returns true if the anomaly dot should still be visible (UI persistence) */
export function isDotVisible(state: ChannelState): boolean {
  return state.isAnomalous || (Date.now() - state.lastAnomalyTime < ANOMALY_UI_PERSIST_MS);
}

/** Anomalies per minute (rolling 60-second window) */
export function anomalyRate(state: ChannelState): number {
  const now = Date.now();
  const recent = state.anomalyTimestamps.filter(t => now - t < ANOMALY_RATE_WINDOW_MS);
  return recent.length; // count in last 60s = per-minute rate
}
