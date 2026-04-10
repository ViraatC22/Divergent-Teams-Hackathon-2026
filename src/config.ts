import type { ChannelName, ClassificationLabel } from './types';

export const WS_DEFAULT_URL = 'ws://localhost:3001';
export const BUFFER_SIZE = 150;
export const RECONNECT_INTERVAL_MS = 3000;
export const STALE_THRESHOLD_MS = 6000;

export const ANOMALY_Z_THRESHOLD = 2;
export const ANOMALY_UI_PERSIST_MS = 10000;
export const ANOMALY_RATE_WINDOW_MS = 60000;

export const CORRELATION_INTERVAL_MS = 30000;
export const FORECAST_INTERVAL_MS = 10000;
export const SPARKLINE_SAMPLES = 30;

export const CHANNEL_LABELS: Record<ChannelName, string> = {
  altitude: 'Altitude',
  temperature: 'Temperature',
  pressure: 'Pressure',
  soilPercent: 'Soil Moisture',
  vibrationRMS: 'Vibration',
};

export const CHANNEL_UNITS: Record<ChannelName, string> = {
  altitude: 'm',
  temperature: '°C',
  pressure: 'hPa',
  soilPercent: '%',
  vibrationRMS: 'g',
};

export const CHANNEL_ICONS: Record<ChannelName, string> = {
  altitude: '⛰',
  temperature: '🌡',
  pressure: '🌀',
  soilPercent: '🌱',
  vibrationRMS: '📳',
};

export const THRESHOLDS = {
  temperature: { optimalMin: 15, optimalMax: 30, critical: 40 },
  soilPercent: { criticalLow: 15, warningLow: 25, warningHigh: 80 },
  vibrationRMS: { maxExpected: 10 },
  tilt: { maxExpected: 45 },
  altitude: { maxVariation: 50 }, // meaningful swing over a session (metres)
} as const;

export const HEALTH_WEIGHTS = {
  soil: 0.35,
  temperature: 0.30,
  vibration: 0.20,
  tilt: 0.15,
} as const;

export const CLASSIFICATION_COLORS: Record<ClassificationLabel, string> = {
  'Optimal': '#22c55e',
  'Drought Risk': '#ef4444',
  'Pest Alert': '#f97316',
  'Terrain Warning': '#f59e0b',
};

export const CLASSIFICATION_BG: Record<ClassificationLabel, string> = {
  'Optimal': 'rgba(34,197,94,0.12)',
  'Drought Risk': 'rgba(239,68,68,0.12)',
  'Pest Alert': 'rgba(249,115,22,0.12)',
  'Terrain Warning': 'rgba(245,158,11,0.12)',
};

export const ALERT_DEDUP_WINDOW_MS = 30000;

// Simulation scenario durations in seconds
export const SIM_SCENARIOS = [
  { label: 'Optimal' as ClassificationLabel, duration: 45 },
  { label: 'Drought Risk' as ClassificationLabel, duration: 30 },
  { label: 'Pest Alert' as ClassificationLabel, duration: 25 },
  { label: 'Terrain Warning' as ClassificationLabel, duration: 20 },
];
