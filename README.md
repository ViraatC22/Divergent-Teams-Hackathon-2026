# AgriSwarm Field Monitor

A real-time agricultural field robot dashboard. Ingests live sensor data from an ESP32 via WebSocket, runs all analytics client-side, and adds user authentication, persistent notifications, and session metrics via Clerk + Supabase.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling / Animation | Tailwind CSS + shadcn/ui + GSAP 3 |
| Auth | Clerk (React SDK) |
| Database | Supabase (PostgreSQL + RLS) |
| Bridge Server | Express + `ws` (Node.js) |
| Hardware | ESP32 + sensors |
| Tunnel | ngrok (free tier) |

---

## Prerequisites

- Node.js 18+
- `npm`
- A [Clerk](https://clerk.com) account (free)
- A [Supabase](https://supabase.com) project (free)
- ngrok installed and authenticated (for live hardware — not needed for simulation mode)

---

## Environment Setup

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Clerk — from Clerk Dashboard → API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase — from Supabase Dashboard → Project Settings → API
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Never commit `.env`** — it is in `.gitignore`. The service role key bypasses Row Level Security and must stay server-side only.

---

## Supabase Database Setup

Run this SQL once in your Supabase project (SQL Editor → New Query):

```sql
-- User profiles (synced from Clerk on sign-in)
create table if not exists profiles (
  id           text primary key,
  email        text not null,
  full_name    text,
  username     text,
  image_url    text,
  updated_at   timestamptz default now()
);

-- Metric events (login, session_end, feature_usage, export_*)
create table if not exists user_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references profiles(id),
  metric_type  text not null,
  metric_value jsonb default '{}',
  created_at   timestamptz default now()
);

-- In-app notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references profiles(id),
  title      text not null,
  message    text not null,
  type       text not null,   -- 'alert' | 'info' | 'export'
  is_read    boolean default false,
  created_at timestamptz default now()
);

-- RLS policies (anon key can read own rows; server service role bypasses RLS entirely)
alter table profiles      enable row level security;
alter table user_metrics  enable row level security;
alter table notifications enable row level security;

create policy "Users read own profile"
  on profiles for select using (auth.uid()::text = id);

create policy "Users read own notifications"
  on notifications for select using (auth.uid()::text = user_id);
```

---

## Install

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required — the project pins Vite 8 which has a peer conflict with `@vitejs/plugin-react`.

---

## Running the Project

Two terminals are required.

**Terminal 1 — bridge server:**

```bash
node server/index.js
```

Starts on `http://localhost:3001`. Receives HTTP POSTs from the ESP32, broadcasts over WebSocket to the dashboard, and serves all `/api/*` routes (profile sync, metrics, notifications).

**Terminal 2 — frontend:**

```bash
npm run dev
```

Opens at `http://localhost:5174` (or 5173). Sign in with Clerk when prompted. The dashboard WebSocket URL defaults to `ws://localhost:3001`.

---

## Live Hardware (ESP32)

**One-time setup — install and authenticate ngrok:**

```bash
brew install ngrok
ngrok config add-authtoken <your-token-from-ngrok-dashboard>
```

**Each session — start the tunnel:**

```bash
ngrok http 3001
```

Copy the `https://xxxx.ngrok-free.app` URL into `hardwareCode.ino`:

```cpp
const char* serverName = "https://xxxx.ngrok-free.app/data";
```

Re-flash the ESP32. The dashboard WebSocket stays as `ws://localhost:3001` — ngrok only exposes the server to the internet so the ESP32 can reach it.

> **Note:** The free ngrok plan randomizes the URL each session. You must update `serverName` and re-flash after every restart.

---

## Auth Flow

1. User visits the landing page and clicks **Enter Dashboard**
2. If not signed in, Clerk's sign-in modal opens
3. After sign-in, the dashboard mounts
4. On mount, the dashboard calls `POST /api/sync-profile` to upsert the Clerk user into Supabase `profiles`
5. A `login` metric event is also logged automatically
6. On sign-out, the user is returned to the landing page

No Clerk webhooks are used — profile sync is frontend-driven to avoid dependency on a stable ngrok URL.

---

## Features

### Simulation Mode
Toggle **Simulate** in the status bar to generate realistic sensor data locally. The simulator cycles through Drought → Optimal → Pest → Terrain scenarios over ~2 minutes. No hardware required — judges can see all states.

### Live Sensor Readings
Five sensor cards (Temperature, Pressure, Soil Moisture, Distance, Vibration) with:
- GSAP-tweened value updates (numbers animate smoothly between readings)
- Per-channel sparklines
- Anomaly pulse animation (red glow on card when anomaly detected)

### AI Analysis Engine
- **Anomaly Detection** — z-score per channel, anomaly rate/min
- **Correlation Heatmap** — 5×5 Pearson matrix with auto-generated insight strings for |r| > 0.7
- **Stress Classification** — rule-based (Optimal / Drought Risk / Pest Alert / Terrain Warning) with confidence %
- **Trend Forecasting** — OLS linear regression, 15/30-min projection, threshold-crossing warnings

### Health Score
Weighted composite 0–100 displayed in the status bar with GSAP number tweening and a shake animation if the score drops more than 15 points.

### Alert Feed
Scrollable feed of classification alerts with severity badges, generated recommendation strings, and deduplication (same type within 30s collapses with a "persisting for Xs" counter).

### In-App Notifications
Bell icon in the status bar polls `GET /api/notifications/:userId` every 30 seconds. Unread count badge shown. Click to open dropdown; click a notification to mark it read. Notifications are triggered automatically by:
- Critical alerts (Drought Risk, Pest Alert, Terrain Warning)
- Temperature forecast crossing 40°C within 30 min
- CSV/JSON exports

### Session Metrics
- Session start/end durations logged to `user_metrics`
- Export actions logged as `export_csv` / `export_json` events
- Simulation toggle and feature usage tracked

### Session Summary
- Total scan duration, data points received
- Anomaly counts per channel
- Time-in-state donut chart (% of session in each classification)
- Export buttons (CSV + JSON) — export events trigger in-app notifications

---

## Project Structure

```
agriswarm-dashboard/
├── .env.example
├── server/
│   └── index.js              # Express bridge: /data, /api/* routes, WebSocket
├── src/
│   ├── main.tsx              # ClerkProvider, Root (auth routing), App entry
│   ├── App.tsx               # Dashboard shell, WebSocket, Clerk/Supabase wiring
│   ├── types.ts              # SensorPacket, ChannelState, ClassificationEntry, etc.
│   ├── config.ts             # Thresholds, weights, defaults
│   ├── index.css             # Tailwind base + GSAP animation utilities
│   ├── lib/
│   │   ├── supabase.ts       # Supabase anon client
│   │   └── utils.ts          # cn() helper
│   ├── hooks/
│   │   └── useMetrics.ts     # logMetric + createNotification helpers
│   ├── connection/
│   │   ├── websocket.ts      # WebSocket connect, reconnect, parse
│   │   └── simulator.ts      # Fake data generator
│   ├── engine/
│   │   ├── anomaly.ts
│   │   ├── correlation.ts
│   │   ├── classification.ts
│   │   ├── regression.ts
│   │   └── healthScore.ts
│   ├── components/
│   │   ├── LandingPage.tsx   # Animated landing + Clerk auth nav
│   │   ├── StatusBar.tsx     # Connection, health, classification, user controls
│   │   ├── SensorCard.tsx    # GSAP-tweened sensor value cards
│   │   ├── NotificationBell.tsx
│   │   ├── AlertFeed.tsx
│   │   ├── SessionSummary.tsx
│   │   ├── TrendForecast.tsx
│   │   ├── DonutChart.tsx
│   │   ├── CorrelationHeatmap.tsx
│   │   ├── AnomalySummary.tsx
│   │   ├── ClassificationLog.tsx
│   │   ├── Sparkline.tsx
│   │   └── ui/               # shadcn/ui primitives
│   └── utils/
│       ├── formatters.ts
│       ├── stats.ts
│       └── export.ts
├── hardwareCode.ino
└── package.json
```

---

## Thresholds Reference

| Parameter | Optimal | Warning | Critical |
|---|---|---|---|
| Temperature | 15–30°C | 30–35°C | >35°C or <10°C |
| Soil Moisture | 40–80% | 25–40% | <25% |
| Vibration RMS | <0.5g | 0.5–1.5g | >1.5g |
| Tilt | <10° | 10–20° | >20° |
| Obstacle Distance | >30cm | 15–30cm | <15cm |
| Pressure | 1010–1025 hPa | 1005–1010 hPa | <1005 hPa |
| Temperature forecast | — | — | 40°C crossing |
| Soil forecast | — | — | 15% crossing |

---

## Troubleshooting

**"Awaiting reading" despite data in server terminal**
The stale threshold may be too tight for your ESP32's send interval. Increase `STALE_THRESHOLD_MS` in `src/config.ts` to at least 2× your `delay()` value (default is 12s).

**Dashboard shows no data in cards at all**
The parser in `src/types.ts` expects specific field ordering. Check the raw payload logged by the server against the `parsePacket()` regex patterns — a mismatch silently returns `null` and drops every packet.

**Soil moisture lower than expected**
The ESP32 ADC is 12-bit (0–4095). If using a different microcontroller, update the divisor in `parsePacket()` in `src/types.ts`.

**Notifications not appearing**
Ensure the bridge server is running (`node server/index.js`) — notifications are stored in Supabase via the server's service role key. Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`.

**Clerk sign-in not redirecting to dashboard**
Make sure `VITE_CLERK_PUBLISHABLE_KEY` is set correctly in `.env` and the frontend dev server was restarted after adding it.
