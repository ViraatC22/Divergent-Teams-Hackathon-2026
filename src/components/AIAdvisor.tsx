import React, { useState, useCallback } from 'react';
import type { SensorPacket, ClassificationResult, ChannelState, ChannelName } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'gemini';

interface AnalysisResult {
  text: string;
  provider: Provider;
  timestamp: number;
}

interface Props {
  lastPacket: SensorPacket | null;
  classification: ClassificationResult;
  healthScore: number;
  channelStates: Record<ChannelName, ChannelState>;
  correlationInsights: string[];
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: { id: Provider; label: string; model: string; color: string }[] = [
  { id: 'anthropic', label: 'Claude',  model: 'claude-haiku-4-5',    color: '#d97706' },
  { id: 'openai',    label: 'GPT-4o',  model: 'gpt-4o-mini',         color: '#10b981' },
  { id: 'gemini',    label: 'Gemini',  model: 'gemini-1.5-flash',    color: '#6366f1' },
];

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  packet: SensorPacket,
  classification: ClassificationResult,
  healthScore: number,
  channelStates: Record<ChannelName, ChannelState>,
  insights: string[],
): string {
  const now = Date.now();
  const anomalyLines = CHANNELS
    .map(ch => {
      const recent = channelStates[ch].anomalyTimestamps.filter(t => now - t < 60000).length;
      return recent > 0 ? `  • ${CHANNEL_LABELS[ch]}: ${recent} spike(s) in last 60 s` : null;
    })
    .filter(Boolean)
    .join('\n');

  const insightLines = insights.slice(0, 3).map(i => `  • ${i}`).join('\n');
  const triggerText = classification.triggers.length > 0
    ? classification.triggers.join(', ')
    : 'none';

  return `You are a friendly field agronomist reviewing data sent by an autonomous crop-monitoring robot. \
Explain in plain language — suitable for a non-technical farmer — what the sensor readings indicate about the health of the crops, \
what is likely causing any problems, and what specific actions the farmer should take right now. \
Be warm, practical, and concise (under 130 words). Do not use bullet points; write in short paragraphs.

CURRENT SENSOR READINGS:
  • Temperature:         ${packet.temperature.toFixed(1)} °C  (healthy range: 15–30 °C)
  • Soil Moisture:       ${packet.soilPercent} %  (warning < 25 %, critical < 15 %)
  • Air Pressure:        ${packet.pressure.toFixed(0)} hPa
  • Altitude:            ${packet.altitude.toFixed(1)} m
  • Vibration (RMS):     ${packet.vibrationRMS.toFixed(2)} g
  • Ground Tilt X / Y:  ${packet.tiltX.toFixed(1)} ° / ${packet.tiltY.toFixed(1)} °

FIELD DIAGNOSTICS:
  • Health score:  ${healthScore} / 100
  • Condition:     ${classification.label}  (${(classification.confidence * 100).toFixed(0)} % confidence)
  • Alerts active: ${triggerText}
${anomalyLines ? `\nRECENT ANOMALIES:\n${anomalyLines}` : ''}
${insightLines ? `\nDETECTED PATTERNS:\n${insightLines}` : ''}

Respond in plain English only. No markdown headers, no bullet lists.`;
}

// ─── Per-provider API calls ───────────────────────────────────────────────────

async function callAI(provider: Provider, model: string, apiKey: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          // Required to allow direct browser calls to the Anthropic API
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { content: { text: string }[] };
      return data.content[0]?.text ?? '';
    }

    case 'openai': {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? '';
    }

    case 'gemini': {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300 },
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: { message?: string } }).error?.message;
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as {
        candidates: { content: { parts: { text: string }[] } }[];
      };
      return data.candidates[0]?.content?.parts[0]?.text ?? '';
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AIAdvisor: React.FC<Props> = ({
  lastPacket,
  classification,
  healthScore,
  channelStates,
  correlationInsights,
}) => {
  const [expanded, setExpanded]     = useState(true);
  const [provider, setProvider]     = useState<Provider>('anthropic');
  const [apiKey, setApiKey]         = useState('');
  const [showKey, setShowKey]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const providerMeta = PROVIDERS.find(p => p.id === provider)!;
  const canAnalyze = !!lastPacket && apiKey.trim().length > 0 && !loading;

  const handleAnalyze = useCallback(async () => {
    if (!lastPacket || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const prompt = buildPrompt(lastPacket, classification, healthScore, channelStates, correlationInsights);
      const text = await callAI(provider, providerMeta.model, apiKey.trim(), prompt);
      setResult({ text, provider, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error — check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [lastPacket, apiKey, provider, providerMeta, classification, healthScore, channelStates, correlationInsights]);

  // Format the analysis timestamp
  const resultAge = result
    ? Math.round((Date.now() - result.timestamp) / 1000)
    : null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 16 }}>🌾</span>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', color: '#22c55e' }}>
          AI CROP ADVISOR
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          — plain-language field diagnosis
        </span>
        <div style={{ flex: 1 }} />
        {result && !loading && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            analysed {resultAge}s ago · {PROVIDERS.find(p => p.id === result.provider)?.label}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Provider + Key row ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>

            {/* Provider tabs */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 5 }}>
                AI PROVIDER
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    className="btn"
                    onClick={e => { e.stopPropagation(); setProvider(p.id); setResult(null); setError(null); }}
                    style={{
                      fontSize: 11,
                      fontWeight: provider === p.id ? 700 : 400,
                      borderColor: provider === p.id ? p.color : undefined,
                      color: provider === p.id ? p.color : undefined,
                      background: provider === p.id ? `${p.color}18` : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API key input */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 5 }}>
                API KEY
                <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 400, letterSpacing: 0 }}>
                  (session-only — never stored or transmitted to any server)
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  placeholder={`Paste your ${providerMeta.label} API key…`}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="btn"
                  title={showKey ? 'Hide key' : 'Reveal key'}
                  onClick={e => { e.stopPropagation(); setShowKey(s => !s); }}
                  style={{ fontSize: 14, padding: '0 10px' }}
                >
                  {showKey ? '🙈' : '👁'}
                </button>
                {apiKey && (
                  <button
                    className="btn"
                    title="Clear key"
                    onClick={e => { e.stopPropagation(); setApiKey(''); setError(null); }}
                    style={{ fontSize: 12, color: '#ef4444' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Analyze button */}
            <button
              className={`btn ${canAnalyze ? 'btn-green' : ''}`}
              disabled={!canAnalyze}
              onClick={e => { e.stopPropagation(); handleAnalyze(); }}
              style={{
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: 12,
                opacity: canAnalyze ? 1 : 0.45,
                minWidth: 120,
              }}
            >
              {loading
                ? '⏳ Analysing…'
                : !lastPacket
                  ? 'No data yet'
                  : '🔍 Analyse Crops'}
            </button>
          </div>

          {/* ── Loading shimmer ── */}
          {loading && (
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '14px 16px',
              color: 'var(--text-muted)',
              fontSize: 13,
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>🌀</span>
              Asking {providerMeta.label} to analyse your field data…
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              padding: '12px 14px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 3 }}>
                  API Error
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</div>
              </div>
            </div>
          )}

          {/* ── Result card ── */}
          {result && !loading && (
            <div style={{
              background: 'var(--bg-primary)',
              border: `1px solid ${PROVIDERS.find(p => p.id === result.provider)!.color}44`,
              borderLeft: `3px solid ${PROVIDERS.find(p => p.id === result.provider)!.color}`,
              borderRadius: 6,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {/* Result header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>🌾</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: PROVIDERS.find(p => p.id === result.provider)!.color,
                  letterSpacing: '0.06em',
                }}>
                  {PROVIDERS.find(p => p.id === result.provider)!.label.toUpperCase()} FIELD DIAGNOSIS
                </span>
                <div style={{ flex: 1 }} />
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  based on reading at {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {/* Result text */}
              <p style={{
                fontSize: 13.5,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {result.text.trim()}
              </p>
              {/* Re-analyze nudge */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Press the button again after the next reading to update the diagnosis.
              </div>
            </div>
          )}

          {/* ── Empty state (no data yet, no result) ── */}
          {!lastPacket && !loading && !result && !error && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              padding: '4px 0',
            }}>
              Waiting for first sensor reading before analysis is available.
            </div>
          )}

        </div>
      )}
    </div>
  );
};
