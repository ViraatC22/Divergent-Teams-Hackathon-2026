export interface SensorPacket {
  timestamp: number;
  altitude: number;
  temperature: number;
  pressure: number;
  soilRaw: number;
  soilPercent: number;
  tiltX: number;
  tiltY: number;
  vibrationRMS: number;
}

/**
 * Parses the ESP32 wire format:
 * T:25.8C | P:990.2hPa | Alt:193.8m | Acc:-0.4,0.1,10.3 | Tilt:0.7,2.2 | M:912
 */
export function parsePacket(raw: string): SensorPacket | null {
  try {
    const tMatch   = raw.match(/T:([\-\d.]+)C/);
    const pMatch   = raw.match(/P:([\-\d.]+)hPa/);
    const altMatch = raw.match(/Alt:([\-\d.]+)m/);
    const accMatch = raw.match(/Acc:([\-\d.]+)[,|]([\-\d.]+)[,|]([\-\d.]+)/);
    const tiltMatch = raw.match(/Tilt:([\-\d.]+)[,|]([\-\d.]+)/);
    const mMatch   = raw.match(/M:(\d+)/);

    if (!tMatch || !pMatch || !altMatch || !accMatch || !tiltMatch || !mMatch) return null;

    const temperature = parseFloat(tMatch[1]);
    const pressure    = parseFloat(pMatch[1]);
    const altitude    = parseFloat(altMatch[1]);
    const accX        = parseFloat(accMatch[1]);
    const accY        = parseFloat(accMatch[2]);
    const accZ        = parseFloat(accMatch[3]);
    const tiltX       = parseFloat(tiltMatch[1]);
    const tiltY       = parseFloat(tiltMatch[2]);
    const soilRaw     = parseInt(mMatch[1], 10);

    if ([temperature, pressure, altitude, accX, accY, accZ, tiltX, tiltY, soilRaw].some(isNaN)) return null;

    const vibrationRMS = Math.sqrt(accX * accX + accY * accY + accZ * accZ);
    const soilPercent  = Math.round((soilRaw / 4095) * 100);

    return {
      timestamp: Date.now(),
      altitude,
      temperature,
      pressure,
      soilRaw,
      soilPercent,
      tiltX,
      tiltY,
      vibrationRMS,
    };
  } catch {
    return null;
  }
}

export type ChannelName = 'altitude' | 'temperature' | 'pressure' | 'soilPercent' | 'vibrationRMS';
export const CHANNELS: ChannelName[] = ['altitude', 'temperature', 'pressure', 'soilPercent', 'vibrationRMS'];

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
