/**
 * AgriSwarm bridge server
 *
 * Receives HTTP POST /data from the ESP32 (via ngrok public URL),
 * then broadcasts the raw payload string to all connected browser
 * WebSocket clients so the React dashboard can parse and display it.
 *
 * Also handles:
 *  POST   /api/sync-profile         — upsert Clerk user into Supabase profiles
 *  POST   /api/metrics              — log a user metric event
 *  POST   /api/notifications        — create a notification
 *  GET    /api/notifications/:uid   — fetch notifications for a user
 *  PATCH  /api/notifications/:id/read — mark notification as read
 *
 * Usage:
 *   node server/index.js          # listens on port 3001
 *   PORT=4000 node server/index.js
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.PORT ?? 3001;

// ── Supabase admin client (service role — bypasses RLS) ───────────────────────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ── /data endpoint uses text body (ESP32 sends plain string) ─────────────────
app.post('/data', express.text({ type: '*/*' }), (req, res) => {
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

// ── JSON middleware for all API routes ────────────────────────────────────────
app.use('/api', express.json());

// ── POST /api/sync-profile ────────────────────────────────────────────────────
// Frontend calls this on sign-in to upsert the Clerk user into profiles table.
app.post('/api/sync-profile', async (req, res) => {
  const { id, email, full_name, username, image_url } = req.body;
  if (!id || !email) return res.status(400).json({ error: 'id and email required' });

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id, email, full_name, username, image_url, updated_at: new Date().toISOString() });

  if (error) {
    console.error('[sync-profile]', error.message);
    return res.status(500).json({ error: error.message });
  }

  // Log sign-in metric (upsert means we can't tell new vs returning, so always log login)
  await supabaseAdmin.from('user_metrics').insert({
    user_id: id,
    metric_type: 'login',
    metric_value: { timestamp: new Date().toISOString() },
  });

  res.sendStatus(200);
});

// ── POST /api/metrics ─────────────────────────────────────────────────────────
app.post('/api/metrics', async (req, res) => {
  const { userId, metricType, metricValue } = req.body;
  if (!userId || !metricType) return res.status(400).json({ error: 'userId and metricType required' });

  const { error } = await supabaseAdmin.from('user_metrics').insert({
    user_id:      userId,
    metric_type:  metricType,
    metric_value: metricValue ?? {},
  });

  if (error) {
    console.error('[metrics]', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.sendStatus(201);
});

// ── POST /api/notifications ───────────────────────────────────────────────────
app.post('/api/notifications', async (req, res) => {
  const { userId, title, message, type } = req.body;
  if (!userId || !title || !message || !type) {
    return res.status(400).json({ error: 'userId, title, message, type required' });
  }

  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId, title, message, type,
  });

  if (error) {
    console.error('[notifications POST]', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.sendStatus(201);
});

// ── GET /api/notifications/:userId ────────────────────────────────────────────
app.get('/api/notifications/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[notifications GET]', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json(data ?? []);
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
app.patch('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    console.error('[notifications PATCH]', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.sendStatus(200);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, clients: clients.size }));

// ── WebSocket setup ───────────────────────────────────────────────────────────
const httpServer = createServer(app);
const wss        = new WebSocketServer({ server: httpServer });
const clients    = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] client connected  (total: ${clients.size})`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] client disconnected (total: ${clients.size})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`AgriSwarm bridge running on http://localhost:${PORT}`);
  console.log(`  ESP32 POST endpoint : http://localhost:${PORT}/data  (expose via ngrok)`);
  console.log(`  Dashboard WS        : ws://localhost:${PORT}`);
});
