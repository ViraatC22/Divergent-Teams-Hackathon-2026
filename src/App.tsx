import React, { useRef, useState, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useUser } from '@clerk/clerk-react';
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
import { useMetrics } from './hooks/useMetrics';

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

const SERVER = 'http://localhost:3001';

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
      return `Soil moisture at ${kv.soil ?? '?'}% — switch to drip irrigation in this zone to cut water use by up to 50% and reduce runoff`;
    case 'Pest Alert':
      return `Ground vibration at ${kv.vibration ?? '?'} g near ${kv.altitude ?? '?'} m elevation — consider targeted biological pest control to avoid broad-spectrum pesticide runoff`;
    case 'Terrain Warning':
      return `Tilt ${kv.tiltX ?? '?'}° / ${kv.tiltY ?? '?'}° detected — plant cover crops on this slope to prevent erosion and sequester carbon`;
    default:
      return 'Field conditions nominal — maintain current sustainable practices';
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const sessionStart = useRef(Date.now());

  // ── Auth & metrics ────────────────────────────────────────────────────────
  const { user } = useUser();
  const { logMetric, createNotification } = useMetrics(user?.id);

  // ── Profile sync (frontend-driven, no webhook needed) ────────────────────
  const profileSyncedRef = useRef(false);
  useEffect(() => {
    if (!user || profileSyncedRef.current) return;
    profileSyncedRef.current = true;
    fetch(`${SERVER}/api/sync-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:        user.id,
        email:     user.primaryEmailAddress?.emailAddress ?? '',
        full_name: user.fullName ?? '',
        username:  user.username ?? '',
        image_url: user.imageUrl ?? '',
      }),
    }).catch(() => {}); // non-critical
  }, [user]);

  // ── Session start/end metrics ────────────────────────────────────────────
  useEffect(() => {
    logMetric('session_start', { page: 'dashboard' });
    const t0 = Date.now();

    const handleUnload = () => {
      const duration = Math.round((Date.now() - t0) / 1000);
      navigator.sendBeacon(
        `${SERVER}/api/metrics`,
        JSON.stringify({ userId: user?.id, metricType: 'session_end', metricValue: { duration_seconds: duration } }),
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      logMetric('session_end', { duration_seconds: Math.round((Date.now() - t0) / 1000) });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notification flags (once per session) ────────────────────────────────
  const sentCriticalNotifRef   = useRef(false);
  const sentTempThreshNotifRef = useRef(false);
  const sentSoilThreshNotifRef = useRef(false);

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

  // Boot sequence refs
  const statusBarWrapRef   = useRef<HTMLDivElement>(null);
  const sensorSectionRef   = useRef<HTMLDivElement>(null);
  const analysisSectionRef = useRef<HTMLDivElement>(null);
  const lowerSectionsRef   = useRef<HTMLDivElement>(null);

  // ── GSAP Boot Sequence ────────────────────────────────────────────────────
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (statusBarWrapRef.current) {
      tl.from(statusBarWrapRef.current, { y: -48, opacity: 0, duration: 0.55 });
    }

    if (sensorSectionRef.current) {
      const cards = sensorSectionRef.current.querySelectorAll('.sensor-card');
      tl.from(sensorSectionRef.current.querySelector('p'), { opacity: 0, y: 12, duration: 0.3 }, '-=0.2')
        .from(cards, { y: 44, opacity: 0, stagger: 0.1, duration: 0.45, ease: 'back.out(1.4)' }, '-=0.15');
    }

    if (analysisSectionRef.current) {
      const children = analysisSectionRef.current.querySelectorAll(':scope > .grid > *');
      tl.from(children, { y: 30, opacity: 0, stagger: 0.12, duration: 0.4 }, '-=0.2');
    }

    if (lowerSectionsRef.current) {
      const children = lowerSectionsRef.current.querySelectorAll(':scope > *');
      tl.from(children, { scale: 0.97, opacity: 0, stagger: 0.08, duration: 0.4 }, '-=0.1');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Notification: first critical alert in session ────────────────────────
  useEffect(() => {
    if (sentCriticalNotifRef.current) return;
    const firstCritical = snapshot.alerts.find(a => a.severity === 'critical');
    if (!firstCritical) return;
    sentCriticalNotifRef.current = true;
    createNotification(
      'Critical Alert Detected',
      `${firstCritical.label}: ${firstCritical.recommendation}`,
      'critical',
    );
  }, [snapshot.alerts, createNotification]);

  // ── Notification: threshold crossing predicted ────────────────────────────
  useEffect(() => {
    const tempMins = periodic.temperatureForecast?.thresholdCrossingMinutes;
    if (!sentTempThreshNotifRef.current && tempMins !== null && tempMins !== undefined) {
      sentTempThreshNotifRef.current = true;
      createNotification(
        'Threshold Warning',
        `Temperature projected critical in ~${tempMins} minutes`,
        'warning',
      );
    }
  }, [periodic.temperatureForecast?.thresholdCrossingMinutes, createNotification]);

  useEffect(() => {
    const soilMins = periodic.soilForecast?.thresholdCrossingMinutes;
    if (!sentSoilThreshNotifRef.current && soilMins !== null && soilMins !== undefined) {
      sentSoilThreshNotifRef.current = true;
      createNotification(
        'Threshold Warning',
        `Soil moisture projected critical in ~${soilMins} minutes`,
        'warning',
      );
    }
  }, [periodic.soilForecast?.thresholdCrossingMinutes, createNotification]);

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

  // ── Export callbacks (log metrics + create notification) ─────────────────
  const handleExportCSV = useCallback((rowCount: number) => {
    logMetric('submission', { export_type: 'csv', rows: rowCount });
    createNotification('Export Ready', `CSV exported with ${rowCount} data points`, 'info');
  }, [logMetric, createNotification]);

  const handleExportJSON = useCallback(() => {
    logMetric('submission', { export_type: 'json' });
    createNotification('Export Ready', 'JSON session data exported', 'info');
  }, [logMetric, createNotification]);

  // ── Simulation toggle ─────────────────────────────────────────────────────
  const toggleSimulation = useCallback(() => {
    setSimulationMode(prev => {
      const next = !prev;
      logMetric('feature_usage', { feature: 'simulation_mode', enabled: next });
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
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div ref={statusBarWrapRef}>
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
          user={user ?? null}
        />
        </div>

        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 dashboard-bg">

          {/* ── Farm Sustainability Advisor ── */}
          <AIAdvisor
            lastPacket={snapshot.lastPacket}
            classification={snapshot.classification}
            healthScore={snapshot.healthScore}
            channelStates={snapshot.channelStates}
            correlationInsights={periodic.correlationInsights}
          />

          {/* ── Live Sensor Data ── */}
          <div className="flex flex-col gap-3" ref={sensorSectionRef}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live Sensor Data</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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

          {/* ── AI Analysis Engine ── */}
          <div className="flex flex-col gap-3" ref={analysisSectionRef}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI Analysis Engine</p>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
              <AnomalySummary channelStates={snapshot.channelStates} />
              <CorrelationHeatmap matrix={periodic.correlationMatrix} insights={periodic.correlationInsights} />
            </div>
          </div>

          {/* ── Lower sections (classification onward) ── */}
          <div ref={lowerSectionsRef} className="flex flex-col gap-5">

          {/* ── Classification Log ── */}
          <ClassificationLog log={snapshot.classificationLog} />

          {/* ── Trend Forecasting ── */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trend Forecasting
              <span className="ml-2 normal-case font-normal tracking-normal">
                (updates every 10s — dashed = projected, shaded = ±1 SE)
              </span>
            </p>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
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
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
          />

          </div>{/* end lower sections */}

        </main>
      </div>
    </div>
  );
}
