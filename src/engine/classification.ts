import type { SensorPacket, ClassificationResult, ClassificationLabel } from '../types';

interface Rule {
  check: (p: SensorPacket) => boolean;
  trigger: string;
}

const rules: Record<string, Rule[]> = {
  drought: [
    { check: (p) => p.soilPercent < 25,     trigger: 'Soil below 25%' },
    { check: (p) => p.temperature > 33,     trigger: 'Temp above 33°C' },
    { check: (p) => p.pressure < 1005,      trigger: 'Low pressure' },
  ],
  pest: [
    { check: (p) => p.vibrationRMS > 1.5,   trigger: 'High vibration' },
    { check: (p) => p.distance < 15,        trigger: 'Close obstacle' },
  ],
  terrain: [
    { check: (p) => Math.abs(p.tiltX) > 20, trigger: 'Steep X tilt' },
    { check: (p) => Math.abs(p.tiltY) > 20, trigger: 'Steep Y tilt' },
  ],
};

const labelMap: Record<string, ClassificationLabel> = {
  drought: 'Drought Risk',
  pest: 'Pest Alert',
  terrain: 'Terrain Warning',
};

export function classify(packet: SensorPacket): ClassificationResult {
  let bestLabel: ClassificationLabel = 'Optimal';
  let bestConfidence = 0;
  let bestTriggers: string[] = [];

  for (const [key, ruleList] of Object.entries(rules)) {
    const met = ruleList.filter(r => r.check(packet));
    const confidence = met.length / ruleList.length;

    if (confidence >= 0.5 && confidence > bestConfidence) {
      bestConfidence = confidence;
      bestLabel = labelMap[key];
      bestTriggers = met.map(r => r.trigger);
    }
  }

  const isOptimal = bestLabel === 'Optimal';
  const confidence = isOptimal ? 1.0 : bestConfidence;
  const triggers = isOptimal ? [] : bestTriggers;

  const keyValues = buildKeyValues(packet, bestLabel);

  return { label: bestLabel, confidence, triggers, keyValues };
}

function buildKeyValues(p: SensorPacket, label: ClassificationLabel): Record<string, string> {
  switch (label) {
    case 'Drought Risk':
      return {
        soil: `${p.soilPercent}%`,
        temp: `${p.temperature.toFixed(1)}°C`,
        pressure: `${p.pressure.toFixed(0)} hPa`,
      };
    case 'Pest Alert':
      return {
        vibration: `${p.vibrationRMS.toFixed(2)}g`,
        distance: `${p.distance.toFixed(1)}cm`,
      };
    case 'Terrain Warning':
      return {
        tiltX: `${p.tiltX.toFixed(1)}°`,
        tiltY: `${p.tiltY.toFixed(1)}°`,
      };
    default:
      return {
        soil: `${p.soilPercent}%`,
        temp: `${p.temperature.toFixed(1)}°C`,
      };
  }
}
