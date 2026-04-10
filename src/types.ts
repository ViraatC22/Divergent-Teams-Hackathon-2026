export interface SensorPacket {
  timestamp: number;
  distance: number;
  temperature: number;
  pressure: number;
  soilRaw: number;
  soilPercent: number;
  tiltX: number;
  tiltY: number;
  vibrationRMS: number;
}

export function parsePacket(raw: string): SensorPacket | null {
  const parts = raw.trim().split(',').map(Number);
  if (parts.length !== 7 || parts.some(isNaN)) return null;
  return {
    timestamp: Date.now(),
    distance: parts[0],
    temperature: parts[1],
    pressure: parts[2],
    soilRaw: parts[3],
    soilPercent: Math.round((parts[3] / 1023) * 100),
    tiltX: parts[4],
    tiltY: parts[5],
    vibrationRMS: parts[6],
  };
}

export type ChannelName = 'distance' | 'temperature' | 'pressure' | 'soilPercent' | 'vibrationRMS';
export const CHANNELS: ChannelName[] = ['distance', 'temperature', 'pressure', 'soilPercent', 'vibrationRMS'];

export interface ChannelState {
  buffer: number[];
  zScore: number;
  isAnomalous: boolean;
  lastAnomalyTime: number;
  anomalyCount: number;
  anomalyTimestamps: number[];
}

export type ClassificationLabel = 'Optimal' | 'Drought Risk' | 'Pest Alert' | 'Terrain Warning';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
export type AlertSeverity = 'warning' | 'critical';

export interface ClassificationResult {
  label: ClassificationLabel;
  confidence: number;
  triggers: string[];
  keyValues: Record<string, string>;
}

export interface ClassificationEntry {
  id: string;
  timestamp: number;
  label: ClassificationLabel;
  confidence: number;
  triggers: string[];
  keyValues: Record<string, string>;
}

export interface AlertEntry {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  label: ClassificationLabel;
  triggers: string[];
  keyValues: Record<string, string>;
  recommendation: string;
  persistingSince: number;
  lastSeen: number;
}

export interface ForecastResult {
  channel: 'temperature' | 'soilPercent';
  historicalValues: number[];
  projectedValues: number[];
  slope: number;
  intercept: number;
  stdError: number;
  thresholdCrossingMinutes: number | null;
  criticalThreshold: number;
}

export interface AppSnapshot {
  lastPacket: SensorPacket | null;
  lastPacketTime: number;
  isStale: boolean;
  healthScore: number;
  classification: ClassificationResult;
  channelStates: Record<ChannelName, ChannelState>;
  alerts: AlertEntry[];
  classificationLog: ClassificationEntry[];
  totalPackets: number;
  sessionClassificationCounts: Record<ClassificationLabel, number>;
  allPackets: SensorPacket[];
}

export interface PeriodicState {
  correlationMatrix: number[][];
  correlationInsights: string[];
  temperatureForecast: ForecastResult | null;
  soilForecast: ForecastResult | null;
}
