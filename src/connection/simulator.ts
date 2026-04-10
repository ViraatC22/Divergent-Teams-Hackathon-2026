import type { SensorPacket } from '../types';
import { SIM_SCENARIOS } from '../config';
import { gaussianRandom, lerp, clamp } from '../utils/stats';

interface ScenarioTargets {
  altitude: number;
  temperature: number;
  pressure: number;
  soilRaw: number;
  tiltX: number;
  tiltY: number;
  vibrationRMS: number;
}

const SCENARIO_TARGETS: ScenarioTargets[] = [
  // Optimal — flat field, good conditions
  { altitude: 198, temperature: 22, pressure: 1015, soilRaw: 614, tiltX: 2, tiltY: 1, vibrationRMS: 0.25 },
  // Drought Risk — slight elevation, hot, dry, low pressure
  { altitude: 185, temperature: 36, pressure: 1002, soilRaw: 205, tiltX: 3, tiltY: 2, vibrationRMS: 0.38 },
  // Pest Alert — high vibration (ground disturbance activity)
  { altitude: 195, temperature: 26, pressure: 1012, soilRaw: 461, tiltX: 5, tiltY: 4, vibrationRMS: 1.95 },
  // Terrain Warning — steep slope, higher altitude
  { altitude: 221, temperature: 21, pressure: 1018, soilRaw: 563, tiltX: 26, tiltY: 18, vibrationRMS: 0.75 },
];

const SCENARIO_NOISE: ScenarioTargets[] = [
  { altitude: 1.5, temperature: 0.5, pressure: 0.8, soilRaw: 20, tiltX: 1,   tiltY: 1,   vibrationRMS: 0.05 },
  { altitude: 2.0, temperature: 0.8, pressure: 1.2, soilRaw: 30, tiltX: 1.5, tiltY: 1,   vibrationRMS: 0.08 },
  { altitude: 1.5, temperature: 0.5, pressure: 0.6, soilRaw: 25, tiltX: 2,   tiltY: 1.5, vibrationRMS: 0.30 },
  { altitude: 3.0, temperature: 0.4, pressure: 0.5, soilRaw: 20, tiltX: 4,   tiltY: 3,   vibrationRMS: 0.15 },
];

export class Simulator {
  private current: ScenarioTargets;
  private scenarioIndex = 0;
  private elapsedSeconds = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private onPacket: (p: SensorPacket) => void;

  constructor(onPacket: (p: SensorPacket) => void) {
    this.onPacket = onPacket;
    this.current = { ...SCENARIO_TARGETS[0] };
  }

  start() {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.tick(), 2000);
    // Fire immediately
    this.tick();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private tick() {
    this.elapsedSeconds += 2;
    const scenarioDuration = SIM_SCENARIOS[this.scenarioIndex].duration;

    // Advance scenario if time is up
    if (this.elapsedSeconds >= scenarioDuration) {
      this.elapsedSeconds = 0;
      this.scenarioIndex = (this.scenarioIndex + 1) % SIM_SCENARIOS.length;
    }

    const target = SCENARIO_TARGETS[this.scenarioIndex];
    const noise = SCENARIO_NOISE[this.scenarioIndex];

    // Smoothly move current values toward target (lerp factor 0.12 per tick)
    const lerpFactor = 0.12;
    const keys = Object.keys(target) as (keyof ScenarioTargets)[];
    for (const key of keys) {
      this.current[key] = lerp(this.current[key], target[key], lerpFactor);
    }

    // Occasional spikes (5% chance per tick)
    const hasSpike = Math.random() < 0.05;

    const d = (key: keyof ScenarioTargets) =>
      this.current[key] + gaussianRandom(0, noise[key]) + (hasSpike ? gaussianRandom(0, noise[key] * 3) : 0);

    const altitude     = clamp(d('altitude'), 0, 9000);
    const soilRaw      = clamp(Math.round(d('soilRaw')), 0, 1023);
    const temperature  = clamp(d('temperature'), -40, 85);
    const pressure     = clamp(d('pressure'), 300, 1100);
    const tiltX        = clamp(d('tiltX'), -90, 90);
    const tiltY        = clamp(d('tiltY'), -90, 90);
    const vibrationRMS = clamp(d('vibrationRMS'), 0, 10);

    const packet: SensorPacket = {
      timestamp: Date.now(),
      altitude,
      temperature,
      pressure,
      soilRaw,
      soilPercent: Math.round((soilRaw / 1023) * 100),
      tiltX,
      tiltY,
      vibrationRMS,
    };

    this.onPacket(packet);
  }
}
