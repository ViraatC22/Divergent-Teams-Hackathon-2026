/**
 * AgriSwarm bridge server
 *
 * Receives HTTP POST /data from the ESP32 (via ngrok public URL),
 * then broadcasts the raw payload string to all connected browser
 * WebSocket clients so the React dashboard can parse and display it.
 *
 * Usage:
 *   node server/index.js          # listens on port 3001
 *   PORT=4000 node server/index.js
 *
 * Then expose publicly with:
 *   ngrok http 3001
 * Give the resulting https://... URL to the ESP32 as its POST endpoint.
 * The React dashboard connects to ws://localhost:3001 (same machine).
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ?? 3001;

const app = express();

// Accept any text body (ESP32 sends plain string, not JSON)
app.use(express.text({ type: '*/*' }));

// Allow ngrok / browser cross-origin preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

/** All currently connected browser dashboard clients */
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] client connected  (total: ${clients.size})`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] client disconnected (total: ${clients.size})`);
  });
});

/**
 * POST /data
 * ESP32 sends: T:25.8C | P:990.2hPa | Alt:193.8m | Acc:-0.4,0.1,10.3 | Tilt:0.7,2.2 | M:912
 */
app.post('/data', (req, res) => {
  const payload = String(req.body ?? '').trim();
  if (!payload) { res.sendStatus(400); return; }

  let forwarded = 0;
  for (const client of clients) {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(payload);
      forwarded++;
    }
  }

  console.log(`[POST /data] "${payload}" → forwarded to ${forwarded} client(s)`);
  res.sendStatus(200);
});

// Health-check so ngrok / uptime monitors have something to hit
app.get('/health', (_req, res) => res.json({ ok: true, clients: clients.size }));

httpServer.listen(PORT, () => {
  console.log(`AgriSwarm bridge running on http://localhost:${PORT}`);
  console.log(`  ESP32 POST endpoint : http://localhost:${PORT}/data  (expose via ngrok)`);
  console.log(`  Dashboard WS        : ws://localhost:${PORT}`);
});
