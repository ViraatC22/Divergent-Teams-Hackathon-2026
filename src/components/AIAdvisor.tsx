import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Leaf, Search, Eye, EyeOff, X, Loader2, AlertCircle, ChevronDown, ChevronUp, ListTodo, Mail, MessageSquare, CalendarPlus, Check } from 'lucide-react';
import type { SensorPacket, ClassificationResult, ChannelState, ChannelName } from '../types';
import { CHANNELS } from '../types';
import { CHANNEL_LABELS } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
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
  { id: 'gemini',    label: 'Gemini',  model: 'gemini-3-flash-preview'  },
];

// ─── Todo extraction ──────────────────────────────────────────────────────────

function extractTodos(markdown: string): string[] {
  const todos: string[] = [];
  // Match bold action titles: **Some Title** at the start of a line
  const boldTitleRe = /\*\*(.+?)\*\*/g;
  // Match numbered list items: "1. something" or "1) something"
  const numberedRe = /^\d+[.)]\s+\*?\*?(.+?)\*?\*?$/;

  // First try: extract bold-titled steps (our structured format)
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // A numbered line that starts a new step
    const numbered = trimmed.match(numberedRe);
    if (numbered) {
      // Strip any markdown bold markers and grab the title
      const clean = numbered[1].replace(/\*\*/g, '').trim();
      if (clean.length > 2) todos.push(clean);
    }
  }

  // Fallback: pull all bold phrases if we got nothing
  if (todos.length === 0) {
    let m: RegExpExecArray | null;
    while ((m = boldTitleRe.exec(markdown)) !== null) {
      const clean = m[1].trim();
      if (clean.length > 3) todos.push(clean);
    }
  }

  // Final fallback: non-empty lines that look like actions
  if (todos.length === 0) {
    for (const line of lines) {
      const t = line.trim().replace(/^[-•*]\s+/, '');
      if (t.length > 10 && t.length < 120) todos.push(t);
    }
  }

  return todos.slice(0, 8);
}

// ─── Farm context options ─────────────────────────────────────────────────────

const CROP_TYPES = ['Vegetables', 'Grains', 'Fruit / Orchard', 'Livestock Pasture', 'Mixed'];
const IRRIGATION_METHODS = ['Flood', 'Sprinkler', 'Drip', 'Rain-fed / None'];
const FARM_SIZES = ['< 5 acres', '5–20 acres', '20–100 acres', '100+ acres'];

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  packet: SensorPacket,
  classification: ClassificationResult,
  healthScore: number,
  channelStates: Record<ChannelName, ChannelState>,
  insights: string[],
  cropType: string,
  irrigationMethod: string,
  farmSize: string,
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

  return `You are a farm sustainability consultant reviewing live sensor data from an autonomous soil-monitoring rover. \
The farmer wants a concrete, prioritised action plan to reduce their environmental footprint and improve long-term land health.

FARM CONTEXT:
  • Crop type:         ${cropType}
  • Irrigation method: ${irrigationMethod}
  • Farm size:         ${farmSize}

CURRENT SENSOR READINGS:
  • Temperature:        ${packet.temperature.toFixed(1)} °C  (optimal: 15–30 °C)
  • Soil Moisture:      ${packet.soilPercent} %  (warning < 25 %, critical < 15 %)
  • Air Pressure:       ${packet.pressure.toFixed(0)} hPa
  • Altitude / Terrain: ${packet.altitude.toFixed(1)} m
  • Ground Vibration:   ${packet.vibrationRMS.toFixed(2)} g RMS
  • Ground Tilt X / Y: ${packet.tiltX.toFixed(1)} ° / ${packet.tiltY.toFixed(1)} °

FIELD STATUS:
  • Sustainability score: ${healthScore} / 100
  • Condition:            ${classification.label}  (${(classification.confidence * 100).toFixed(0)} % confidence)
  • Active alerts:        ${triggerText}
${anomalyLines ? `\nRECENT SENSOR ANOMALIES:\n${anomalyLines}` : ''}
${insightLines ? `\nDETECTED PATTERNS:\n${insightLines}` : ''}

Generate a numbered action plan with 3–5 steps. For each step, provide:
- The specific action the farmer should take
- The environmental benefit (water saved, energy reduced, soil health, CO₂ impact)
- A rough cost estimate (low/medium/high or dollar range if obvious)
- Timeline: today / this week / this month

For each step use this format:
"1. **[Action title]**
   What to do: [2-3 sentences describing the specific action]
   Environmental impact: [water saved, energy reduced, soil/CO₂ benefit]
   Cost estimate: [low/medium/high or dollar range]
   Timeline: [today / this week / this month]"

Be thorough and specific to the sensor readings and farm context above. Do not truncate — complete all steps fully.`;
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
            generationConfig: {},
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
  const [expanded, setExpanded]       = useState(true);
  const [provider, setProvider]       = useState<Provider>('anthropic');
  const [apiKey, setApiKey]           = useState('');
  const [showKey, setShowKey]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [cropType, setCropType]       = useState(CROP_TYPES[0]);
  const [irrigationMethod, setIrrigationMethod] = useState(IRRIGATION_METHODS[0]);
  const [farmSize, setFarmSize]       = useState(FARM_SIZES[0]);
  const [todoOpen, setTodoOpen]       = useState(false);
  const [checked, setChecked]         = useState<Record<number, boolean>>({});

  const providerMeta = PROVIDERS.find(p => p.id === provider)!;
  const canAnalyze   = !!lastPacket && apiKey.trim().length > 0 && !loading;

  const handleAnalyze = useCallback(async () => {
    if (!lastPacket || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const prompt = buildPrompt(lastPacket, classification, healthScore, channelStates, correlationInsights, cropType, irrigationMethod, farmSize);
      const text   = await callAI(provider, providerMeta.model, apiKey.trim(), prompt);
      setResult({ text, provider, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error — check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [lastPacket, apiKey, provider, providerMeta, classification, healthScore, channelStates, correlationInsights, cropType, irrigationMethod, farmSize]);

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
          <CardTitle className="text-sm">Farm Sustainability Advisor</CardTitle>
          <span className="text-xs text-muted-foreground font-normal">— get a specific action plan</span>
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

          {/* ── Farm context row ── */}
          <div className="flex items-end gap-3 flex-wrap">
            {[
              { label: 'Crop Type',  value: cropType,         onChange: (v: string) => { setCropType(v); setResult(null); },         options: CROP_TYPES },
              { label: 'Irrigation', value: irrigationMethod, onChange: (v: string) => { setIrrigationMethod(v); setResult(null); }, options: IRRIGATION_METHODS },
              { label: 'Farm Size',  value: farmSize,         onChange: (v: string) => { setFarmSize(v); setResult(null); },         options: FARM_SIZES },
            ].map(({ label, value, onChange, options }) => (
              <div key={label}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                <select
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

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
                ? <><Loader2 size={12} className="spin-anim" /> Generating…</>
                : !lastPacket
                  ? 'No data yet'
                  : <><Search size={12} /> Generate Action Plan</>
              }
            </Button>
          </div>

          {/* ── Loading state ── */}
          {loading && (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground italic">
              <Loader2 size={16} className="spin-anim shrink-0 text-emerald-400" />
              Asking {providerMeta.label} to generate your sustainability action plan…
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
                  {PROVIDERS.find(p => p.id === result.provider)?.label} Sustainability Action Plan
                </span>
                <div className="flex-1" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  based on reading at {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none
                [&_p]:text-sm [&_p]:text-foreground [&_p]:leading-relaxed [&_p]:my-1
                [&_strong]:text-foreground [&_strong]:font-semibold
                [&_ol]:text-sm [&_ol]:text-foreground [&_ol]:pl-4 [&_ol]:space-y-3
                [&_ul]:text-sm [&_ul]:text-foreground [&_ul]:pl-4 [&_ul]:space-y-1
                [&_li]:leading-relaxed
                [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground
                [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground
                [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-muted-foreground [&_h3]:uppercase [&_h3]:tracking-wider">
                <ReactMarkdown>{result.text.trim()}</ReactMarkdown>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground">
                  Press the button again after the next reading to update the action plan.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={e => { e.stopPropagation(); setChecked({}); setTodoOpen(true); }}
                >
                  <ListTodo size={12} /> Convert to To-Do List
                </Button>
              </div>
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

      {/* ── Todo Modal ── */}
      {result && (
        <TodoModal
          open={todoOpen}
          onClose={() => setTodoOpen(false)}
          todos={extractTodos(result.text)}
          checked={checked}
          onToggle={i => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
          farmContext={{ cropType, irrigationMethod, farmSize }}
        />
      )}
    </Card>
  );
};

// ─── Todo Modal ───────────────────────────────────────────────────────────────

interface TodoModalProps {
  open: boolean;
  onClose: () => void;
  todos: string[];
  checked: Record<number, boolean>;
  onToggle: (i: number) => void;
  farmContext: { cropType: string; irrigationMethod: string; farmSize: string };
}

function TodoModal({ open, onClose, todos, checked, onToggle, farmContext }: TodoModalProps) {
  const subject = encodeURIComponent('Farm Sustainability Action Plan');
  const body = todos.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const encodedBody = encodeURIComponent(`Farm Sustainability Action Plan\n(${farmContext.cropType} · ${farmContext.irrigationMethod} · ${farmContext.farmSize})\n\n${body}`);

  const handleEmail = () => {
    window.open(`mailto:?subject=${subject}&body=${encodedBody}`, '_blank');
  };

  const handleSMS = () => {
    window.open(`sms:?body=${encodedBody}`, '_blank');
  };

  const handleCalendar = () => {
    const details = encodeURIComponent(body);
    const title = encodeURIComponent('Farm Sustainability Action Plan');
    // Creates a single all-day event with all steps in the description
    const today = new Date();
    const dateStr = today.toISOString().replace(/-/g, '').split('T')[0];
    window.open(
      `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}&dates=${dateStr}/${dateStr}`,
      '_blank',
    );
  };

  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ListTodo size={14} className="text-emerald-400" />
            <DialogTitle>Sustainability To-Do List</DialogTitle>
          </div>
          <DialogDescription>
            {farmContext.cropType} · {farmContext.irrigationMethod} · {farmContext.farmSize}
            {doneCount > 0 && (
              <span className="ml-2 text-emerald-400 font-medium">
                · {doneCount}/{todos.length} done
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Todo items */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {todos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No action items found.</p>
          ) : (
            todos.map((todo, i) => (
              <button
                key={i}
                onClick={() => onToggle(i)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors w-full',
                  checked[i]
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-muted-foreground line-through'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted/60',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  checked[i] ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400' : 'border-muted-foreground/40',
                )}>
                  {checked[i] && <Check size={10} />}
                </span>
                <span className="text-xs leading-relaxed">{todo}</span>
              </button>
            ))
          )}
        </div>

        {/* Share actions */}
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Share or Save
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleEmail}
            >
              <Mail size={12} /> Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleSMS}
            >
              <MessageSquare size={12} /> Text
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleCalendar}
            >
              <CalendarPlus size={12} /> Google Calendar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
