# AgriSwarm Web Dashboard

## What This Is

A single-page React + TypeScript web dashboard for an agricultural field robot (ESP32). It ingests live sensor data via a WebSocket bridge server and runs all analytics client-side.

---

## How to Run

### 1. Install dependencies

```bash
npm install --legacy-peer-deps
```

> Use `--legacy-peer-deps` — the project pins Vite 8 which has a peer conflict with `@vitejs/plugin-react`.

### 2. Start the bridge server (in one terminal)

```bash
node server/index.js
```

This runs on `http://localhost:3001`. It receives HTTP POSTs from the ESP32 and forwards the data to the dashboard over WebSocket.

### 3. Start the frontend (in another terminal)

```bash
npm run dev
```

Opens at `http://localhost:5174` (or 5173 if the port is free). In the dashboard, the WebSocket URL field should be set to `ws://localhost:3001`.

### 4. Expose the bridge server to the internet (for ESP32)

```bash
ngrok http 3001
```

Copy the `https://xxxx.ngrok-free.app` URL and paste it into `hardwareCode.ino` as the `serverName`:

```cpp
const char* serverName = "https://xxxx.ngrok-free.app/data";
```

Then re-flash the ESP32. The dashboard WebSocket stays as `ws://localhost:3001` — ngrok is only needed so the ESP32 can reach your machine.

---

## Common Mistakes

### "Awaiting reading" shows even though the terminal is getting updates

The bridge server receives data fine, but the dashboard marks it stale because the ESP32 sends every ~6-7 seconds (5s delay + processing + ngrok latency) and the stale threshold was set to 6s. The threshold in [src/config.ts](src/config.ts) has been updated to 12s to account for this.

If your ESP32 has a longer send interval, increase `STALE_THRESHOLD_MS` in `src/config.ts` to at least 2× your `delay()` value.

### Dashboard shows "Awaiting reading" but no data appears in the cards at all

The parser in [src/types.ts](src/types.ts) expects `Acc` and `Tilt` values separated by either `,` or `|`. If you change the ESP32 payload format, make sure the regex patterns in `parsePacket()` match what the hardware actually sends. A mismatch causes `parsePacket` to silently return `null` and drop every packet.

You can verify what the ESP32 is sending by watching the bridge server terminal — it prints each raw payload.

### Soil moisture reads much lower than expected

The ESP32's ADC is 12-bit (range 0–4095). The soil percent is calculated as `soilRaw / 4095 * 100`. If you swap to a different microcontroller with a 10-bit ADC (range 0–1023), update the divisor in `parsePacket()` inside [src/types.ts](src/types.ts).

### ngrok URL changes every restart

On the free ngrok plan, the public URL is randomized each session. Every time you restart ngrok you must update `serverName` in `hardwareCode.ino` and re-flash the ESP32. Upgrade to a paid ngrok plan (static domain) or use a different tunnel tool to avoid this.

---

---

## Tech Stack

- **React 18** with **TypeScript**
- **Vite** for dev server and build
- **Canvas-based charts** (no chart libraries — draw directly on `<canvas>` for performance)
- **Browser WebSocket API** (native, no socket.io)
- **In-memory state only** (no localStorage, no database)
- **Tailwind CSS** for styling
- Keep dependencies minimal. No axios, no lodash, no moment.js.

---

## Data Contract

### Packet Format

The ESP8266 sends a **comma-separated string** over WebSocket every 2 seconds. No JSON — raw CSV line terminated by newline:

```
distance,temperature,pressure,soilRaw,tiltX,tiltY,vibrationRMS
```

**Example:**
```
24.5,31.2,1013.25,487,12.3,-3.1,0.87
```

### Field Map

| Index | Field          | Source   | Unit    | Range         |
|-------|----------------|----------|---------|---------------|
| 0     | distance       | HC-SR04  | cm      | 2–400         |
| 1     | temperature    | BMP280   | °C      | -40–85        |
| 2     | pressure       | BMP280   | hPa     | 300–1100      |
| 3     | soilRaw        | FSR402   | ADC     | 0–1023        |
| 4     | tiltX          | MPU6050  | degrees | -90–90        |
| 5     | tiltY          | MPU6050  | degrees | -90–90        |
| 6     | vibrationRMS   | MPU6050  | g       | 0–10          |

### Parsing Logic

```typescript
interface SensorPacket {
  timestamp: number;      // Date.now() at parse time
  distance: number;
  temperature: number;
  pressure: number;
  soilRaw: number;
  soilPercent: number;    // Math.round((soilRaw / 1023) * 100)
  tiltX: number;
  tiltY: number;
  vibrationRMS: number;
}

function parsePacket(raw: string): SensorPacket | null {
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
```

Keep the parsing layer **isolated in one file** so we can swap the format easily.

---

## Data Layer

### Circular Buffers

Every parsed packet pushes values into per-channel circular buffers. Window size: **150 samples** (~5 minutes at 2s intervals).

**5 channels for anomaly detection and correlation:**
- `distance`
- `temperature`
- `pressure`
- `soilPercent`
- `vibrationRMS`

`tiltX` and `tiltY` are used for classification only — not anomaly/correlation (terrain tilt is expected to vary).

Each channel tracks:
```typescript
interface ChannelState {
  buffer: number[];
  lastAnomalyTime: number;
  anomalyCount: number;
  isAnomalous: boolean;
}
```

---

## WebSocket Connection

### Requirements
- Connect to a configurable endpoint (default: `ws://192.168.4.1:81`)
- Provide a text input field in the UI for the user to change the WebSocket URL
- Auto-reconnect every **3 seconds** on disconnect
- Track connection state: `connected` | `reconnecting` | `disconnected`
- Flag **stale data** if no packet arrives within **6 seconds** of the last one

### Demo / Simulation Mode
**Critical for hackathon:** Include a **simulation toggle** that generates fake sensor data locally when the robot isn't connected. The simulator should:
- Produce realistic-looking data with gradual trends, occasional spikes, and noise
- Cycle through different stress scenarios (drought → optimal → pest → terrain warning) over ~2 minutes so judges can see all states
- Use the exact same `processPacket()` pipeline as real data

---

## UI Sections

### 1. Live Status Bar (always visible, top of page)

- **Connection indicator**: green dot = connected, yellow dot = reconnecting, red dot = disconnected
- **Last data timestamp**: human-readable "2s ago", "5s ago". Shows ⚠️ if >6s stale
- **Field Health Score**: 0–100, single large number with color (green >70, yellow 40–70, red <40)
  - Weighted composite: soil moisture (35%) + temperature deviation from 15–30°C optimal (30%) + vibration intensity (20%) + terrain tilt (15%)
  - Temperature score: 100 when in 15–30°C range, decreasing linearly outside it
  - Soil score: soilPercent directly (0–100)
  - Vibration score: 100 - (vibrationRMS / maxExpectedRMS * 100), clamped to 0–100
  - Tilt score: 100 - (max(|tiltX|, |tiltY|) / 45 * 100), clamped to 0–100
- **AI Classification Label**: "Optimal" / "Drought Risk" / "Pest Alert" / "Terrain Warning"
- **Confidence**: percentage next to the label

### 2. Real-Time Sensor Panel

5 cards in a responsive grid. Each card shows:
- Sensor name and icon
- **Current value** with unit (large text)
- **60-second sparkline** rendered on a small `<canvas>` (last 30 samples)
- **Anomaly badge**: red pulsing dot if `isAnomalous === true` for that channel
- **Anomaly rate**: "X.X / min" in small text

Card-specific extras:
- **Temperature**: green band overlay on sparkline at 15–30°C
- **Pressure**: show delta-per-minute (current minus value from 30 samples ago, divided by 1)
- **Soil**: show mapped 0–100% label
- **Distance**: (no extra)
- **Vibration**: (no extra)

### 3. AI Analysis Engine

This is the core differentiator. Four sub-panels:

#### 3a. Anomaly Detection Summary
- Table with one row per channel: channel name, current z-score, anomaly status (normal/anomalous), anomaly count, anomaly rate/min
- Refresh every packet

#### 3b. Correlation Heatmap
- 5×5 grid (distance, temperature, pressure, soilPercent, vibrationRMS)
- Cell color: blue (-1) → white (0) → red (+1) via RGB interpolation
- Recalculate every **30 seconds**
- Below the heatmap: list of **auto-generated insight strings** for any |r| > 0.7

**Pearson r formula** (single-pass):
```
r = (nΣxy - ΣxΣy) / sqrt((nΣx² - (Σx)²)(nΣy² - (Σy)²))
```

**Insight templates** (keyed by sorted channel pair):
```typescript
const insightTemplates: Record<string, string> = {
  "temperature_soilPercent":  "Soil dryness correlated with temperature",
  "temperature_pressure":     "Pressure shifts tracking temperature change",
  "distance_vibrationRMS":    "Vibration spikes coincide with nearby obstacles",
  "soilPercent_pressure":     "Soil moisture linked to barometric changes",
  "soilPercent_vibrationRMS": "Ground disturbance affecting moisture readings",
  "distance_temperature":     "Temperature variation near obstructions",
  "distance_pressure":        "Pressure changes near obstacles",
  "distance_soilPercent":     "Soil conditions vary with obstacle proximity",
  "pressure_vibrationRMS":    "Vibration linked to pressure changes",
  "temperature_vibrationRMS": "Temperature shifts coincide with vibration",
};
```

Format: `"${template} — ${r > 0 ? 'positively' : 'inversely'} (r = ${r.toFixed(2)})"`

#### 3c. Stress Classification Log
- Scrollable table, newest on top
- Columns: Time, Label, Confidence %, Triggers, Key Values
- Filter dropdown by label (All / Optimal / Drought / Pest / Terrain)
- Export button → downloads CSV

**Classification rules:**
```typescript
const rules = {
  drought: [
    (p) => p.soilPercent < 25,       // "Soil below 25%"
    (p) => p.temperature > 33,       // "Temp above 33°C"
    (p) => p.pressure < 1005,        // "Low pressure"
  ],
  pest: [
    (p) => p.vibrationRMS > 1.5,     // "High vibration"
    (p) => p.distance < 15,          // "Close obstacle"
  ],
  terrain: [
    (p) => Math.abs(p.tiltX) > 20,   // "Steep X tilt"
    (p) => Math.abs(p.tiltY) > 20,   // "Steep Y tilt"
  ],
};
```

Confidence = conditions met / total conditions for that rule. Highest confidence wins. Minimum 50% to trigger. Below 50% on all = "Optimal" at 100%.

#### 3d. Trend Forecasting
- Runs every **10 seconds** on `temperature` and `soilPercent` buffers
- Ordinary least-squares linear regression on last 150 samples
- Projects forward **15 min** (450 steps) and **30 min** (900 steps)
- Renders on a canvas chart:
  - Solid line = historical data
  - Dashed line = projected trend
  - Shaded band = ±1 standard error confidence band
- **Threshold crossing warnings**:
  - Temperature critical: **40°C**
  - Soil critical low: **15%**
  - If projected to cross within 30 min → display warning with estimated time: "Soil moisture projected to reach critical low in ~18 minutes"

### 4. Historical Charts Panel

- One time-series line chart per sensor channel, drawn on `<canvas>`
- X-axis: time (last 5 minutes / full session, toggleable)
- Pan and zoom via mouse drag / scroll
- **Overlay mode**: dropdown to select two channels on one chart with independent Y-axes
- **Background bands**: color-coded by AI classification active at each timestamp
  - Green = Optimal, Yellow = Terrain Warning, Orange = Pest Alert, Red = Drought Risk
- **Hover tooltip**: exact values + active classification at that moment

### 5. Alert Feed

- Vertical scrollable feed, newest on top
- Each alert card:
  - Timestamp (human readable)
  - Severity badge: `info` (blue) / `warning` (yellow) / `critical` (red)
  - Classification type
  - Triggering sensor values
  - **Generated recommendation string** (use a template map):
    - Drought: "Temperature at {temp}°C with soil contact at {soil}% — irrigate this zone immediately"
    - Pest: "Vibration of {vib}g detected with obstacle at {dist}cm — inspect for pest activity"
    - Terrain: "Tilt at {tilt}° — terrain erosion risk, avoid heavy equipment"
- **Deduplication**: same classification + same severity within 30 seconds → collapse into one alert with "persisting for Xs" counter
- **Critical alerts**: pulsing red border + browser Notification API (request permission on first critical)

### 6. Session Summary (bottom panel)

- Total scan duration (mm:ss)
- Total data points received
- Anomaly count per channel (small bar chart or table)
- **Time-in-state donut chart**: % of session in each classification (Optimal / Drought / Pest / Terrain)
- **Top finding**: the single most statistically significant correlation or trend crossing from the session, stated in one sentence
- **Export buttons**: JSON (full raw data + classifications) and CSV (flattened sensor table)

---

## Design Direction

**Aesthetic: Industrial / utilitarian field-tech.** Think military HUD meets agricultural simplicity.

- **Dark theme** — dark charcoal/slate background (#0f1419 range), not pure black
- **Accent color**: vibrant green (#22c55e) for healthy, amber (#f59e0b) for warning, red (#ef4444) for critical
- **Font**: monospace for values (JetBrains Mono or Source Code Pro from Google Fonts), clean sans-serif for labels (DM Sans or similar)
- **Cards**: subtle borders, slight background elevation, no heavy shadows
- **Charts**: thin lines, no grid clutter, dark backgrounds, bright data lines
- **Status indicators**: small colored dots, not giant badges
- **Layout**: dense but scannable — this is a monitoring dashboard, not a marketing page
- **Responsive**: must work on laptop screen and phone screen (judges may look at phone during demo)

---

## File Structure

```
agriswarm-dashboard/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts                    # SensorPacket, ChannelState, ClassificationEntry, etc.
│   ├── config.ts                   # thresholds, weights, defaults, WS URL
│   ├── connection/
│   │   ├── websocket.ts            # WebSocket connect, reconnect, parse
│   │   └── simulator.ts            # fake data generator for demo mode
│   ├── engine/
│   │   ├── buffers.ts              # circular buffer management
│   │   ├── anomaly.ts              # z-score detection, anomaly rate
│   │   ├── correlation.ts          # pearson matrix, insight generation
│   │   ├── classification.ts       # rule-based stress classifier
│   │   ├── regression.ts           # OLS, projection, threshold crossing
│   │   └── healthScore.ts          # weighted composite score
│   ├── components/
│   │   ├── StatusBar.tsx
│   │   ├── SensorCard.tsx
│   │   ├── Sparkline.tsx           # canvas sparkline component
│   │   ├── AnomalySummary.tsx
│   │   ├── CorrelationHeatmap.tsx
│   │   ├── ClassificationLog.tsx
│   │   ├── TrendForecast.tsx
│   │   ├── HistoricalChart.tsx
│   │   ├── AlertFeed.tsx
│   │   ├── SessionSummary.tsx
│   │   └── DonutChart.tsx          # canvas donut for time-in-state
│   └── utils/
│       ├── stats.ts                # mean, std, pearson, regression helpers
│       ├── formatters.ts           # time formatting, number formatting
│       └── export.ts               # CSV/JSON download helpers
```

---

## Key Implementation Notes

1. **No placeholder logic.** Every analytics function must be fully implemented with real math. The z-score, Pearson r, and linear regression formulas are provided in this document — implement them exactly.

2. **All analysis is client-side.** No fetch calls to any backend except the ESP8266 WebSocket.

3. **Simulation mode is essential.** The demo must work without the robot present. The simulator should be convincing enough that judges believe it's real data.

4. **Performance matters.** 150-sample buffers, 5 channels, every 2 seconds. Canvas rendering, not SVG or DOM nodes for chart points. Keep re-renders minimal — use refs for canvas, only re-render React components when classification state changes.

5. **The correlation heatmap and insights are the "wow factor."** Make them visually striking and make the insight strings read like real agricultural analysis.

6. **Export must work.** JSON and CSV downloads must produce real, complete files with all session data.

7. **Responsive layout.** The dashboard will be demoed on both a laptop and a phone held up to show judges. Use a grid that collapses sensibly.

---

## How to Run

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Toggle simulation mode to see data flowing without the robot.

---

## Thresholds Reference

| Parameter              | Optimal Range | Warning      | Critical     |
|------------------------|---------------|--------------|--------------|
| Temperature            | 15–30°C       | 30–35°C      | >35°C or <10°C |
| Soil Moisture          | 40–80%        | 25–40%       | <25%         |
| Vibration RMS          | <0.5g         | 0.5–1.5g     | >1.5g        |
| Tilt                   | <10°          | 10–20°       | >20°         |
| Obstacle Distance      | >30cm         | 15–30cm      | <15cm        |
| Pressure               | 1010–1025 hPa | 1005–1010    | <1005 hPa    |
| Temperature (critical) | —             | —            | 40°C (forecast threshold) |
| Soil (critical)        | —             | —            | 15% (forecast threshold)  |