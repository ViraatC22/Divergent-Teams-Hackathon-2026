import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react';

interface Props {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: Props) {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  // ── Boot sequence ─────────────────────────────────────────────────────────
  const [showScanLine, setShowScanLine] = useState(false);
  const [nameStarted, setNameStarted] = useState(false);
  const [displayedName, setDisplayedName] = useState('');
  const [nameDone, setNameDone] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // ── Live stats ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ temp: 22.4, soil: 61, health: 84 });
  const statsActiveRef = useRef(false);

  // ── Scroll visibility ─────────────────────────────────────────────────────
  const sectionRefs = useRef<(HTMLElement | null)[]>(Array(6).fill(null));
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());

  // Boot: scan line then typewriter
  useEffect(() => {
    const t1 = setTimeout(() => setShowScanLine(true), 300);
    const t2 = setTimeout(() => setNameStarted(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Typewriter
  useEffect(() => {
    if (!nameStarted) return;
    const FULL = 'AGRISWARM';
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayedName(FULL.slice(0, i));
      if (i >= FULL.length) { clearInterval(id); setNameDone(true); }
    }, 80);
    return () => clearInterval(id);
  }, [nameStarted]);

  // Chain reveals after name
  useEffect(() => {
    if (!nameDone) return;
    const t1 = setTimeout(() => setTaglineVisible(true), 200);
    const t2 = setTimeout(() => setSubtitleVisible(true), 500);
    const t3 = setTimeout(() => setCtaVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [nameDone]);

  // Canvas — topographic contour lines + floating particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let t = 0;

    type Particle = { x: number; y: number; vx: number; vy: number; label: string; alpha: number };
    const LABELS = ['23.4°C', '87%', '1013hPa', '0.23g', '198m', '61%', '24.1°C', '992hPa', '0.41g', '201m', '58%', '19.7°C', '1.2g', '47%', '185m', '33.8°C', '0.08g', '77%'];
    let particles: Particle[] = [];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: 20 }, (_, i) => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        label: LABELS[i % LABELS.length],
        alpha: Math.random() * 0.065 + 0.018,
      }));
    };

    init();
    const onResize = () => init();
    window.addEventListener('resize', onResize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.0014;

      const mx = (mouseRef.current.x / (canvas.width || 1) - 0.5);
      const my = (mouseRef.current.y / (canvas.height || 1) - 0.5);

      // Topographic contour lines
      const N = 24;
      for (let li = 0; li < N; li++) {
        const baseY = (li / N) * canvas.height + my * 18;
        const isMajor = li % 6 === 0;
        ctx.globalAlpha = isMajor ? 0.09 : 0.045;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 5) {
          const xd = x + mx * 14;
          const y = baseY
            + Math.sin(xd * 0.0026 + t + li * 0.38) * (22 + li * 1.4)
            + Math.sin(xd * 0.0063 + t * 1.45 + li * 0.85) * 9
            + Math.sin(t * 0.55 + li * 0.22) * 5;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Floating data particles
      ctx.font = '10px "JetBrains Mono", monospace';
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -90) p.x = canvas.width + 90;
        if (p.x > canvas.width + 90) p.x = -90;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = '#22c55e';
        ctx.fillText(p.label, p.x, p.y);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  // Mouse parallax
  useEffect(() => {
    const fn = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  // Live stats random walk
  useEffect(() => {
    const id = setInterval(() => {
      if (!statsActiveRef.current) return;
      setStats(p => ({
        temp: +Math.max(18, Math.min(35, p.temp + (Math.random() - 0.5) * 0.4)).toFixed(1),
        soil: Math.round(Math.max(30, Math.min(90, p.soil + (Math.random() - 0.5) * 1.5))),
        health: Math.round(Math.max(55, Math.min(98, p.health + (Math.random() - 0.5) * 2))),
      }));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  // Intersection observer for scroll reveals
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const idx = sectionRefs.current.indexOf(e.target as HTMLElement);
        if (idx === -1) continue;
        setVisibleSections(prev => new Set([...prev, idx]));
        if (idx === 4) statsActiveRef.current = true;
      }
    }, { threshold: 0.1 });
    sectionRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const setRef = (i: number) => (el: HTMLElement | null) => { sectionRefs.current[i] = el; };

  const vis = (i: number, delayMs = 0): React.CSSProperties => ({
    opacity: visibleSections.has(i) ? 1 : 0,
    transform: visibleSections.has(i) ? 'translateY(0)' : 'translateY(32px)',
    transition: `opacity 0.7s ${delayMs}ms ease, transform 0.7s ${delayMs}ms ease`,
  });

  const healthColor = stats.health > 70 ? '#22c55e' : stats.health > 40 ? '#f59e0b' : '#ef4444';
  const soilColor = stats.soil > 40 ? '#22c55e' : '#f59e0b';

  return (
    <>
      <style>{`
        @keyframes scanSweep {
          0%   { top: -3px; opacity: 1; }
          100% { top: 100vh; opacity: 0; }
        }
        @keyframes ctaGlow {
          0%, 100% { box-shadow: 0 0 18px rgba(34,197,94,0.14); }
          50%       { box-shadow: 0 0 36px rgba(34,197,94,0.32), 0 0 72px rgba(34,197,94,0.07); }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0);   opacity: 0.35; }
          50%       { transform: translateX(-50%) translateY(7px); opacity: 0.6;  }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .lp-cta {
          transition: background 0.15s ease, box-shadow 0.15s ease, opacity 0.4s ease, transform 0.4s ease !important;
        }
        .lp-cta:hover {
          background: rgba(34,197,94,0.2) !important;
          box-shadow: 0 0 40px rgba(34,197,94,0.3) !important;
        }
        .lp-cta:hover .lp-arrow {
          transform: translateX(5px);
        }
        .lp-arrow {
          display: inline-block;
          transition: transform 0.15s ease-out;
        }
        .tech-badge {
          transition: color 0.15s ease, border-color 0.15s ease !important;
        }
        .tech-badge:hover {
          color: #94a3b8 !important;
          border-color: #3a4551 !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', overflowX: 'hidden', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>

        {/* Canvas background */}
        <canvas
          ref={canvasRef}
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        />

        {/* Scan line */}
        {showScanLine && (
          <div style={{
            position: 'fixed', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.5) 20%, #22c55e 50%, rgba(34,197,94,0.5) 80%, transparent 100%)',
            boxShadow: '0 0 10px rgba(34,197,94,0.6)',
            zIndex: 20, pointerEvents: 'none',
            animation: 'scanSweep 0.65s cubic-bezier(0.25, 0, 0.75, 1) forwards',
          }} />
        )}

        {/* ── Auth nav — fixed top-right ───────────────────────────────── */}
        <div style={{
          position: 'fixed', top: 18, right: 24, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {isSignedIn ? (
            <>
              <button
                onClick={onEnter}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  padding: '7px 16px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e',
                }}
              >
                DASHBOARD →
              </button>
              <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
            </>
          ) : (
            <>
              <button
                onClick={() => openSignIn()}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 500, letterSpacing: '0.05em',
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94a3b8',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => openSignUp()}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  color: '#22c55e',
                }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* ── HERO ─────────────────────────────────────────────────── */}
          <section style={{
            minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center',
            padding: '80px 24px',
            position: 'relative',
          }}>
            {/* Ambient glow behind title */}
            <div style={{
              position: 'absolute', top: '46%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 720, height: 480,
              background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.055) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />

            {/* AGRISWARM */}
            <h1 style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: 'clamp(46px, 9.5vw, 96px)',
              letterSpacing: '0.12em',
              color: '#e2e8f0',
              lineHeight: 1,
              margin: '0 0 30px',
              textShadow: '0 0 80px rgba(34,197,94,0.1)',
              opacity: nameStarted ? 1 : 0,
              transition: 'opacity 0.2s',
            }}>
              {displayedName}
              <span style={{
                color: '#22c55e',
                animation: nameDone ? 'none' : 'cursorBlink 0.75s ease-in-out infinite',
                opacity: nameDone ? 0 : 1,
                transition: 'opacity 0.4s 0.6s',
              }}>▌</span>
            </h1>

            {/* Tagline */}
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 'clamp(17px, 2.6vw, 23px)',
              fontWeight: 400,
              color: '#8da3b8',
              maxWidth: 520,
              lineHeight: 1.45,
              margin: '0 0 16px',
              opacity: taglineVisible ? 1 : 0,
              transform: taglineVisible ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.55s ease, transform 0.55s ease',
            }}>
              One robot. Five senses. One AI brain that knows the farm.
            </p>

            {/* Subtitle */}
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: '#344d62',
              letterSpacing: '0.04em',
              margin: '0 0 56px',
              opacity: subtitleVisible ? 1 : 0,
              transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}>
              Real-time agricultural intelligence from a $50 sensor platform
            </p>

            {/* CTA button */}
            <button
              className="lp-cta"
              onClick={onEnter}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.07em',
                padding: '15px 38px',
                borderRadius: 8,
                cursor: 'pointer',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e',
                opacity: ctaVisible ? 1 : 0,
                transform: ctaVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
                animation: ctaVisible ? 'ctaGlow 2.5s ease-in-out infinite' : 'none',
              }}
            >
              ENTER DASHBOARD <span className="lp-arrow">→</span>
            </button>

            {/* Scroll hint */}
            <div style={{
              position: 'absolute', bottom: 38, left: '50%',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: '#243040', letterSpacing: '0.14em',
              animation: ctaVisible ? 'scrollBounce 2.3s ease-in-out infinite' : 'none',
              opacity: ctaVisible ? 1 : 0,
              transition: 'opacity 0.6s 0.8s',
            }}>
              SCROLL ↓
            </div>
          </section>

          {/* ── PROBLEM ──────────────────────────────────────────────── */}
          <section
            ref={setRef(0) as any}
            style={{
              maxWidth: 740, margin: '0 auto',
              padding: '80px 24px 110px',
              textAlign: 'center',
              ...vis(0),
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#22c55e', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 22, opacity: 0.65 }}>
              // PROBLEM STATEMENT
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 4.5vw, 44px)',
              fontWeight: 700,
              color: '#dde4ed',
              lineHeight: 1.15,
              marginBottom: 26,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              40% of crop yield lost to{' '}
              <span style={{ color: '#ef4444', textShadow: '0 0 24px rgba(239,68,68,0.25)' }}>
                invisible threats
              </span>
            </h2>
            <p style={{ fontSize: 15, color: '#546070', lineHeight: 1.9 }}>
              Drought, pest activity, and terrain erosion strike silently — undetected until the damage is done.
              Traditional precision agriculture systems cost tens of thousands of dollars.
              Most farmers are flying blind with no affordable alternative.
            </p>
          </section>

          {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
          <section style={{ padding: '40px 24px 110px', maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#22c55e', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.65 }}>
                // HOW IT WORKS
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 20 }}>
              {([
                {
                  n: '01', title: 'Sense', glyph: '◈', color: '#22c55e', i: 1,
                  desc: '5 sensors scan soil moisture, barometric pressure, temperature, terrain tilt, and acceleration every 5 seconds. No gap in coverage, no blind spots.',
                },
                {
                  n: '02', title: 'Analyze', glyph: '⬡', color: '#3b82f6', i: 2,
                  desc: 'Z-score anomaly detection, Pearson correlation matrices, and rule-based stress classification — patterns no single sensor could catch alone.',
                },
                {
                  n: '03', title: 'Act', glyph: '▶', color: '#f59e0b', i: 3,
                  desc: 'Real-time alerts tell you exactly what\'s wrong, where it is, and what to do — with trend forecasting up to 30 minutes ahead.',
                },
              ] as const).map(card => (
                <div
                  key={card.n}
                  ref={setRef(card.i) as any}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderTop: `2px solid ${card.color}`,
                    borderRadius: 12,
                    padding: '32px 28px',
                    ...vis(card.i, (card.i - 1) * 150),
                  }}
                >
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: card.color, letterSpacing: '0.1em', marginBottom: 20, opacity: 0.6 }}>
                    {card.n}
                  </div>
                  <div style={{ fontSize: 28, color: card.color, marginBottom: 14 }}>{card.glyph}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#dde4ed', marginBottom: 12 }}>{card.title}</div>
                  <div style={{ fontSize: 13, color: '#546070', lineHeight: 1.8 }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── LIVE STATS TEASER ────────────────────────────────────── */}
          <section
            ref={setRef(4) as any}
            style={{ padding: '40px 24px 110px', maxWidth: 860, margin: '0 auto', ...vis(4) }}
          >
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#22c55e', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.65 }}>
                // LIVE PREVIEW
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#243040' }}>
                simulated readings — connect hardware for real data
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {([
                {
                  label: 'TEMPERATURE',
                  value: stats.temp.toFixed(1), unit: '°C',
                  color: '#f97316',
                  bar: Math.min(1, Math.max(0, (stats.temp - 15) / 25)),
                },
                {
                  label: 'SOIL MOISTURE',
                  value: String(stats.soil), unit: '%',
                  color: soilColor,
                  bar: stats.soil / 100,
                },
                {
                  label: 'FIELD HEALTH',
                  value: String(stats.health), unit: '',
                  color: healthColor,
                  bar: stats.health / 100,
                },
              ] as const).map(s => (
                <div
                  key={s.label}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '22px 24px',
                  }}
                >
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em', color: '#3d5166', marginBottom: 14 }}>
                    {s.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 18 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 38, fontWeight: 700,
                      color: s.color, lineHeight: 1,
                      transition: 'color 0.4s',
                    }}>
                      {s.value}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#3d5166' }}>
                      {s.unit}
                    </span>
                  </div>
                  <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 1,
                      background: s.color,
                      width: `${s.bar * 100}%`,
                      transition: 'width 1.3s ease-out, background 0.5s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── TECH STACK ───────────────────────────────────────────── */}
          <section
            ref={setRef(5) as any}
            style={{
              padding: '48px 24px',
              borderTop: '1px solid rgba(42,52,65,0.5)',
              textAlign: 'center',
              ...vis(5),
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#1e2d3a', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 20 }}>
              hardware + software
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
              {['ESP32', 'BMP280', 'MPU6050', 'FSR402', 'React 18', 'TypeScript', 'WebSocket', 'Vite', 'Express', 'ngrok', 'Tailwind CSS'].map(tag => (
                <span
                  key={tag}
                  className="tech-badge"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    padding: '5px 12px',
                    border: '1px solid #1c2a38',
                    borderRadius: 4,
                    color: '#263545',
                    cursor: 'default',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* ── FOOTER ───────────────────────────────────────────────── */}
          <footer style={{
            padding: '28px 24px',
            borderTop: '1px solid rgba(42,52,65,0.35)',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: '#19252f',
              letterSpacing: '0.13em',
            }}>
              DIVERGENT TEAMS HACKATHON 2026 — SUSTAINABILITY TRACK
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
