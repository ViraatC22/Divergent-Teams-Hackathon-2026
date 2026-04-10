import React, { useState, useCallback } from 'react';
import { Leaf, Search, Eye, EyeOff, X, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { SensorPacket, ClassificationResult, ChannelState, ChannelName } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

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

const PROVIDERS: { id: Provider; label: string; model: string }[] = [
  { id: 'anthropic', label: 'Claude',  model: 'claude-haiku-4-5'  },
  { id: 'openai',    label: 'GPT-4o',  model: 'gpt-4o-mini'       },
  { id: 'gemini',    label: 'Gemini',  model: 'gemini-1.5-flash'  },
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
  const [expanded, setExpanded]   = useState(true);
  const [provider, setProvider]   = useState<Provider>('anthropic');
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<AnalysisResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const providerMeta = PROVIDERS.find(p => p.id === provider)!;
  const canAnalyze   = !!lastPacket && apiKey.trim().length > 0 && !loading;

  const handleAnalyze = useCallback(async () => {
    if (!lastPacket || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const prompt = buildPrompt(lastPacket, classification, healthScore, channelStates, correlationInsights);
      const text   = await callAI(provider, providerMeta.model, apiKey.trim(), prompt);
      setResult({ text, provider, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error — check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [lastPacket, apiKey, provider, providerMeta, classification, healthScore, channelStates, correlationInsights]);

  const resultAge = result ? Math.round((Date.now() - result.timestamp) / 1000) : null;

  return (
    <Card>
      {/* ── Header (collapsible) ── */}
      <CardHeader
        className="pb-3 pt-4 px-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Leaf size={14} className="text-emerald-400 shrink-0" />
          <CardTitle className="text-sm">AI Crop Advisor</CardTitle>
          <span className="text-xs text-muted-foreground font-normal">— plain-language field diagnosis</span>
          <div className="flex-1" />
          {result && !loading && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {resultAge}s ago · {PROVIDERS.find(p => p.id === result.provider)?.label}
            </span>
          )}
          {expanded
            ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
            : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          }
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 flex flex-col gap-4">

          {/* ── Provider + Key row ── */}
          <div className="flex items-end gap-3 flex-wrap">

            {/* Provider tabs */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                AI Provider
              </p>
              <div className="flex gap-1.5">
                {PROVIDERS.map(p => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-7 text-xs px-3',
                      provider === p.id && 'border-emerald-500/60 text-emerald-400 bg-emerald-500/10',
                    )}
                    onClick={e => {
                      e.stopPropagation();
                      setProvider(p.id);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* API key input */}
            <div className="flex-1 min-w-[220px]">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                API Key
                <span className="ml-2 normal-case font-normal tracking-normal text-muted-foreground/60">
                  (session-only — never stored)
                </span>
              </p>
              <div className="flex gap-1.5">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={`Paste your ${providerMeta.label} API key…`}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError(null); }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 h-8 text-xs font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  title={showKey ? 'Hide key' : 'Show key'}
                  onClick={e => { e.stopPropagation(); setShowKey(s => !s); }}
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </Button>
                {apiKey && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Clear key"
                    onClick={e => { e.stopPropagation(); setApiKey(''); setError(null); }}
                  >
                    <X size={12} />
                  </Button>
                )}
              </div>
            </div>

            {/* Analyze button */}
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 whitespace-nowrap"
              disabled={!canAnalyze}
              onClick={e => { e.stopPropagation(); handleAnalyze(); }}
            >
              {loading
                ? <><Loader2 size={12} className="spin-anim" /> Analysing…</>
                : !lastPacket
                  ? 'No data yet'
                  : <><Search size={12} /> Analyse Crops</>
              }
            </Button>
          </div>

          {/* ── Loading state ── */}
          {loading && (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground italic">
              <Loader2 size={16} className="spin-anim shrink-0 text-emerald-400" />
              Asking {providerMeta.label} to analyse your field data…
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 flex gap-3 items-start">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1">API Error</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 flex flex-col gap-2 border-l-2 border-l-emerald-500/60">
              <div className="flex items-center gap-2">
                <Leaf size={12} className="text-emerald-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  {PROVIDERS.find(p => p.id === result.provider)?.label} Field Diagnosis
                </span>
                <div className="flex-1" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  based on reading at {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {result.text.trim()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Press the button again after the next reading to update the diagnosis.
              </p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!lastPacket && !loading && !result && !error && (
            <p className="text-xs text-muted-foreground italic">
              Waiting for first sensor reading before analysis is available.
            </p>
          )}

        </CardContent>
      )}
    </Card>
  );
};
