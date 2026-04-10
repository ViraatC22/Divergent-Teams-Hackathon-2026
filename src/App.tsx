import React, { useRef, useState, useEffect, useCallback } from 'react';
import type {
  SensorPacket, ChannelName, AppSnapshot, PeriodicState,
  AlertEntry, ClassificationEntry, ClassificationLabel,
} from './types';
import { CHANNELS, parsePacket } from './types';
import {
  WS_DEFAULT_URL, STALE_THRESHOLD_MS, CORRELATION_INTERVAL_MS,
  FORECAST_INTERVAL_MS, ALERT_DEDUP_WINDOW_MS, CLASSIFICATION_COLORS,
} from './config';
import { makeInitialChannelStates, pushToBuffer } from './engine/buffers';
import { updateChannelAnomaly } from './engine/anomaly';
import { computeCorrelationMatrix, generateInsights } from './engine/correlation';
import { classify } from './engine/classification';
import { computeForecast } from './engine/regression';
import { computeHealthScore } from './engine/healthScore';
import { WSManager } from './connection/websocket';
import { Simulator } from './connection/simulator';

import { StatusBar } from './components/StatusBar';
import { SensorCard } from './components/SensorCard';
import { AnomalySummary } from './components/AnomalySummary';
import { CorrelationHeatmap } from './components/CorrelationHeatmap';
import { ClassificationLog } from './components/ClassificationLog';
import { TrendForecast } from './components/TrendForecast';
import { HistoricalChart } from './components/HistoricalChart';
import { AlertFeed } from './components/AlertFeed';
import { SessionSummary } from './components/SessionSummary';
import { AIAdvisor } from './components/AIAdvisor';

// ─── Connection type ──────────────────────────────────────────────────────────
type ConnStatus = 'connected' | 'reconnecting' | 'disconnected';

// ─── Initial states ───────────────────────────────────────────────────────────
const INITIAL_CLASS_COUNTS: Record<ClassificationLabel, number> = {
  'Optimal': 0, 'Drought Risk': 0, 'Pest Alert': 0, 'Terrain Warning': 0,
};

function makeInitialSnapshot(): AppSnapshot {
  return {
    lastPacket: null,
    lastPacketTime: 0,
    isStale: false,
    healthScore: 0,
    classification: { label: 'Optimal', confidence: 1, triggers: [], keyValues: {} },
    channelStates: makeInitialChannelStates(),
    alerts: [],
    classificationLog: [],
    totalPackets: 0,
    sessionClassificationCounts: { ...INITIAL_CLASS_COUNTS },
    allPackets: [],
  };
}

// ─── Recommendation templates ─────────────────────────────────────────────────
function buildRecommendation(label: ClassificationLabel, kv: Record<string, string>): string {
  switch (label) {
    case 'Drought Risk':
      return `Temperature at ${kv.temp ?? '?'} with soil contact at ${kv.soil ?? '?'} — irrigate this zone immediately`;
    case 'Pest Alert':
      return `Vibration of ${kv.vibration ?? '?'} detected at ${kv.altitude ?? '?'} elevation — inspect for pest activity`;
    case 'Terrain Warning':
      return `Tilt at ${kv.tiltX ?? '?'} / ${kv.tiltY ?? '?'} — terrain erosion risk, avoid heavy equipment`;
    default:
      return 'Field conditions nominal';
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const sessionStart = useRef(Date.now());

  // Mutable refs (no re-render needed)
  const bufferRef = useRef<Record<ChannelName, number[]>>({
    altitude: [], temperature: [], pressure: [], soilPercent: [], vibrationRMS: [],
  });
  const wsManagerRef = useRef<WSManager | null>(null);
  const simulatorRef = useRef<Simulator | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const correlationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forecastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [wsUrl, setWsUrl] = useState(WS_DEFAULT_URL); // ws://localhost:3001 — local Express bridge
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
  const [simulationMode, setSimulationMode] = useState(false);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(makeInitialSnapshot);
  const [periodic, setPeriodic] = useState<PeriodicState>({
    correlationMatrix: [],
    correlationInsights: [],
    temperatureForecast: null,
    soilForecast: null,
  });

  // Classification history for chart background bands
  const classHistoryRef = useRef<{ timestamp: number; label: ClassificationLabel }[]>([]);

  // ── processPacket ─────────────────────────────────────────────────────────
  const processPacket = useCallback((packet: SensorPacket) => {
    // 1. Update per-channel buffers + anomaly state
    const newChannelStates = { ...snapshot } as unknown as AppSnapshot;
    setSnapshot(prev => {
      const channelStates = { ...prev.channelStates };
      for (const ch of CHANNELS) {
        const value = packet[ch] as number;
        channelStates[ch] = updateChannelAnomaly(prev.channelStates[ch], value);
        // Keep the shared buffer ref in sync
        bufferRef.current[ch] = channelStates[ch].buffer;
      }

      // 2. Classify
      const classification = classify(packet);
      const label = classification.label;

      // Track classification history for chart bands
      classHistoryRef.current.push({ timestamp: packet.timestamp, label });

      // 3. Health score
      const healthScore = computeHealthScore(packet);

      // 4. Session classification counts
      const sessionClassificationCounts = { ...prev.sessionClassificationCounts };
      sessionClassificationCounts[label] = (sessionClassificationCounts[label] || 0) + 1;

      // 5. Classification log (only when label changes or first entry)
      let classificationLog = prev.classificationLog;
      const last = classificationLog[0];
      if (!last || last.label !== label || (packet.timestamp - last.timestamp > 10000)) {
        const entry: ClassificationEntry = {
          id: `${packet.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: packet.timestamp,
          label,
          confidence: classification.confidence,
          triggers: classification.triggers,
          keyValues: classification.keyValues,
        };
        classificationLog = [entry, ...classificationLog].slice(0, 500);
      }

      // 6. Alerts (no alerts for Optimal)
      let alerts = prev.alerts;
      if (label !== 'Optimal') {
        const severity = classification.confidence >= 0.75 ? 'critical' : 'warning';
        const now = Date.now();

        // Deduplication: same label + severity within 30s → update lastSeen
        const existing = alerts.find(a =>
          a.label === label &&
          a.severity === severity &&
          (now - a.lastSeen) < ALERT_DEDUP_WINDOW_MS
        );

        if (existing) {
          alerts = alerts.map(a =>
            a.id === existing.id ? { ...a, lastSeen: now } : a
          );
        } else {
          const newAlert: AlertEntry = {
            id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: now,
            severity,
            label,
            triggers: classification.triggers,
            keyValues: classification.keyValues,
            recommendation: buildRecommendation(label, classification.keyValues),
            persistingSince: now,
            lastSeen: now,
          };
          alerts = [newAlert, ...alerts].slice(0, 100);
        }
      }

      return {
        ...prev,
        lastPacket: packet,
        lastPacketTime: packet.timestamp,
        isStale: false,
        healthScore,
        classification,
        channelStates,
        alerts,
        classificationLog,
        totalPackets: prev.totalPackets + 1,
        sessionClassificationCounts,
        allPackets: [...prev.allPackets, packet],
      };
    });
  }, []); // no deps — reads from prev state

  // ── Stale detection ───────────────────────────────────────────────────────
  useEffect(() => {
    staleTimerRef.current = setInterval(() => {
      setSnapshot(prev => {
        if (prev.lastPacketTime === 0) return prev;
        const stale = Date.now() - prev.lastPacketTime > STALE_THRESHOLD_MS;
        if (stale === prev.isStale) return prev;
        return { ...prev, isStale: stale };
      });
    }, 1000);
    return () => { if (staleTimerRef.current) clearInterval(staleTimerRef.current); };
  }, []);

  // ── Correlation (every 30s) ───────────────────────────────────────────────
  useEffect(() => {
    correlationTimerRef.current = setInterval(() => {
      const bufs = bufferRef.current;
      const hasEnough = CHANNELS.every(ch => bufs[ch].length >= 5);
      if (!hasEnough) return;
      const matrix = computeCorrelationMatrix(bufs);
      const insights = generateInsights(matrix);
      setPeriodic(prev => ({ ...prev, correlationMatrix: matrix, correlationInsights: insights }));
    }, CORRELATION_INTERVAL_MS);
    return () => { if (correlationTimerRef.current) clearInterval(correlationTimerRef.current); };
  }, []);

  // ── Forecast (every 10s) ─────────────────────────────────────────────────
  useEffect(() => {
    forecastTimerRef.current = setInterval(() => {
      const bufs = bufferRef.current;
      const tempForecast = computeForecast('temperature', bufs.temperature);
      const soilForecast = computeForecast('soilPercent', bufs.soilPercent);
      setPeriodic(prev => ({
        ...prev,
        temperatureForecast: tempForecast,
        soilForecast: soilForecast,
      }));
    }, FORECAST_INTERVAL_MS);
    return () => { if (forecastTimerRef.current) clearInterval(forecastTimerRef.current); };
  }, []);

  // ── WebSocket connect ─────────────────────────────────────────────────────
  const connectWS = useCallback((url: string) => {
    wsManagerRef.current?.destroy();
    wsManagerRef.current = new WSManager({
      url,
      onPacket: processPacket,
      onStatusChange: setConnStatus,
    });
  }, [processPacket]);

  // ── Simulation toggle ─────────────────────────────────────────────────────
  const toggleSimulation = useCallback(() => {
    setSimulationMode(prev => {
      const next = !prev;
      if (next) {
        // Stop WS, start simulator
        wsManagerRef.current?.destroy();
        wsManagerRef.current = null;
        setConnStatus('connected');
        simulatorRef.current = new Simulator(processPacket);
        simulatorRef.current.start();
      } else {
        // Stop simulator, reconnect WS
        simulatorRef.current?.stop();
        simulatorRef.current = null;
        setConnStatus('disconnected');
        connectWS(wsUrl);
      }
      return next;
    });
  }, [processPacket, connectWS, wsUrl]);

  // On mount: start WS
  useEffect(() => {
    connectWS(wsUrl);
    return () => {
      wsManagerRef.current?.destroy();
      simulatorRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pressure delta ────────────────────────────────────────────────────────
  const pressureBuf = snapshot.channelStates.pressure.buffer;
  const pressureDelta = pressureBuf.length >= 30
    ? pressureBuf[pressureBuf.length - 1] - pressureBuf[pressureBuf.length - 30]
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      <StatusBar
        connectionStatus={connStatus}
        wsUrl={wsUrl}
        onWsUrlChange={setWsUrl}
        onConnect={() => connectWS(wsUrl)}
        simulationMode={simulationMode}
        onToggleSimulation={toggleSimulation}
        lastPacketTime={snapshot.lastPacketTime}
        isStale={snapshot.isStale}
        healthScore={snapshot.healthScore}
        classification={snapshot.classification}
      />

      <main style={{ padding: '20px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── AI Crop Advisor ── */}
        <AIAdvisor
          lastPacket={snapshot.lastPacket}
          classification={snapshot.classification}
          healthScore={snapshot.healthScore}
          channelStates={snapshot.channelStates}
          correlationInsights={periodic.correlationInsights}
        />

        {/* ── Section 1: Sensor Cards ── */}
        <div>
          <div className="section-title">Live Sensor Data</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {CHANNELS.map(ch => (
              <SensorCard
                key={ch}
                channel={ch}
                state={snapshot.channelStates[ch]}
                currentValue={snapshot.lastPacket ? snapshot.lastPacket[ch] as number : null}
                pressureDelta={ch === 'pressure' ? pressureDelta : undefined}
              />
            ))}
          </div>
        </div>

        {/* ── Section 2: AI Analysis ── */}
        <div>
          <div className="section-title">AI Analysis Engine</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            <AnomalySummary channelStates={snapshot.channelStates} />
            <CorrelationHeatmap matrix={periodic.correlationMatrix} insights={periodic.correlationInsights} />
          </div>
        </div>

        {/* ── Classification Log ── */}
        <ClassificationLog log={snapshot.classificationLog} />

        {/* ── Trend Forecasting ── */}
        <div>
          <div className="section-title">Trend Forecasting <span style={{ fontSize: 10, fontWeight: 400 }}>(updates every 10s — dashed = projected, shaded = ±1 SE)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            <TrendForecast
              forecast={periodic.temperatureForecast}
              label="Temperature"
              color="#f97316"
              unit="°C"
            />
            <TrendForecast
              forecast={periodic.soilForecast}
              label="Soil Moisture"
              color="#22c55e"
              unit="%"
            />
          </div>
        </div>

        {/* ── Historical Charts ── */}
        <HistoricalChart
          packets={snapshot.allPackets}
          classificationHistory={classHistoryRef.current}
        />

        {/* ── Alert Feed ── */}
        <AlertFeed alerts={snapshot.alerts} />

        {/* ── Session Summary ── */}
        <SessionSummary
          sessionStart={sessionStart.current}
          totalPackets={snapshot.totalPackets}
          channelStates={snapshot.channelStates}
          sessionClassificationCounts={snapshot.sessionClassificationCounts}
          classificationLog={snapshot.classificationLog}
          allPackets={snapshot.allPackets}
          correlationInsights={periodic.correlationInsights}
        />

      </main>
    </div>
  );
}
