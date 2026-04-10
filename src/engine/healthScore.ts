import type { SensorPacket } from '../types';
import { HEALTH_WEIGHTS, THRESHOLDS } from '../config';
import { clamp } from '../utils/stats';

export function computeHealthScore(p: SensorPacket): number {
  // Soil score: soilPercent directly (0-100)
  const soilScore = clamp(p.soilPercent, 0, 100);

  // Temperature score: 100 in optimal range, decreasing linearly outside
  const { optimalMin, optimalMax } = THRESHOLDS.temperature;
  let tempScore: number;
  if (p.temperature >= optimalMin && p.temperature <= optimalMax) {
    tempScore = 100;
  } else if (p.temperature < optimalMin) {
    tempScore = clamp(100 - (optimalMin - p.temperature) * 5, 0, 100);
  } else {
    tempScore = clamp(100 - (p.temperature - optimalMax) * 5, 0, 100);
  }

  // Vibration score: 100 - (rms / maxExpected * 100), clamped
  const vibScore = clamp(100 - (p.vibrationRMS / THRESHOLDS.vibrationRMS.maxExpected * 100), 0, 100);

  // Tilt score: 100 - (max(|tiltX|,|tiltY|) / 45 * 100), clamped
  const maxTilt = Math.max(Math.abs(p.tiltX), Math.abs(p.tiltY));
  const tiltScore = clamp(100 - (maxTilt / THRESHOLDS.tilt.maxExpected * 100), 0, 100);

  const score =
    soilScore * HEALTH_WEIGHTS.soil +
    tempScore * HEALTH_WEIGHTS.temperature +
    vibScore * HEALTH_WEIGHTS.vibration +
    tiltScore * HEALTH_WEIGHTS.tilt;

  return Math.round(clamp(score, 0, 100));
}

export function healthColor(score: number): string {
  if (score > 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}
