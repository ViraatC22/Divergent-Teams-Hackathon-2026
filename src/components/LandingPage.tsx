import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

interface Props {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: Props) {
  const [ctaVisible, setCtaVisible] = useState(false);
  const [stats, setStats] = useState({ temp: 22.4, soil: 61, health: 84 });
  const statsActiveRef = useRef(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>(Array(6).fill(null));
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setCtaVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!statsActiveRef.current) return;
      setStats(p => ({
        temp:   +Math.max(18, Math.min(35, p.temp + (Math.random() - 0.5) * 0.4)).toFixed(1),
        soil:   Math.round(Math.max(30, Math.min(90, p.soil + (Math.random() - 0.5) * 1.5))),
        health: Math.round(Math.max(55, Math.min(98, p.health + (Math.random() - 0.5) * 2))),
      }));
    }, 1600);
    return () => clearInterval(id);
  }, []);

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
  const vis = (i: number, delay = 0): React.CSSProperties => ({
    opacity: visibleSections.has(i) ? 1 : 0,
    transform: visibleSections.has(i) ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.65s ${delay}ms ease, transform 0.65s ${delay}ms ease`,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');

        /* ── Blob animations ── */
        @keyframes blobFloat0 {
          0%, 100% { transform: translate(0px,  0px)  scale(1);    }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0px, 0px)   scale(1);    }
          33%       { transform: translate(-25px, 20px) scale(1.08); }
          66%       { transform: translate(18px, -12px) scale(0.95); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0px, 0px)  scale(1);    }
          50%       { transform: translate(20px, 25px) scale(1.04); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(0px,   0px) scale(1);    }
          40%       { transform: translate(-15px, -20px) scale(1.06); }
          70%       { transform: translate(10px,  10px)  scale(0.98); }
        }

        .lp-blob-wrap {
          position: absolute;
          top: -120px; left: 50%;
          transform: translateX(-50%);
          width: 700px; height: 520px;
          pointer-events: none;
          filter: blur(2px);
        }
        .lp-blob-layer {
          position: absolute;
          border-radius: 50%;
          mix-blend-mode: screen;
        }
        .lp-blob-0 { width:400px;height:360px;top:50px;left:80px;  background:radial-gradient(ellipse at 40% 40%,#3b82f6 0%,#1d4ed8 40%,transparent 70%); animation:blobFloat0 9s  ease-in-out infinite;         opacity:0.9; }
        .lp-blob-1 { width:340px;height:320px;top:30px;left:210px; background:radial-gradient(ellipse at 55% 45%,#22c55e 0%,#15803d 35%,transparent 68%); animation:blobFloat1 11s ease-in-out infinite;         opacity:0.85; }
        .lp-blob-2 { width:300px;height:280px;top:70px;left:340px; background:radial-gradient(ellipse at 50% 50%,#ec4899 0%,#9d174d 40%,transparent 68%); animation:blobFloat2 13s ease-in-out infinite;         opacity:0.8; }
        .lp-blob-3 { width:220px;height:220px;top:90px;left:150px; background:radial-gradient(ellipse at 50% 50%,#a855f7 0%,#6b21a8 50%,transparent 72%); animation:blobFloat3 8s  ease-in-out infinite;         opacity:0.75; }
        .lp-blob-4 { width:260px;height:200px;top:110px;left:360px;background:radial-gradient(ellipse at 40% 60%,#f97316 0%,#c2410c 50%,transparent 72%); animation:blobFloat0 15s ease-in-out infinite reverse; opacity:0.7; }
        .lp-blob-5 { width:200px;height:180px;top:40px;left:270px; background:radial-gradient(ellipse at 50% 50%,#06b6d4 0%,#0e7490 55%,transparent 68%); animation:blobFloat1 10s ease-in-out infinite reverse; opacity:0.65; }
        .lp-blob-fade {
          position:absolute; bottom:0; left:0; right:0; height:220px;
          background: linear-gradient(to bottom, transparent, #09090b);
          pointer-events:none;
        }

        /* ── CTA pulse ── */
        @keyframes ctaPulse {
          0%,100% { box-shadow: 0 0 0 0 transparent; }
          50%      { box-shadow: 0 0 18px rgba(255,255,255,0.04); }
        }
        .lp-cta-btn { animation: ctaPulse 3s ease-in-out infinite; }
        .lp-cta-btn:hover .lp-arrow { transform: translateX(4px); }
        .lp-arrow { display:inline-block; transition: transform 0.15s ease; }

        /* ── Scroll hint ── */
        @keyframes scrollBounce {
          0%,100% { transform:translateX(-50%) translateY(0);   opacity:0.2; }
          50%      { transform:translateX(-50%) translateY(6px); opacity:0.45; }
        }
        .lp-scroll-hint {
          position:absolute; bottom:36px; left:50%;
          font-family:'JetBrains Mono',monospace;
          font-size:9px; letter-spacing:0.18em;
          color:#3f3f46;
          animation: scrollBounce 2.4s ease-in-out infinite;
        }

        /* ── Section reveal ── */
        .lp-mono { font-family:'JetBrains Mono',monospace; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7', fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 24px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Blob — only color on the page */}
          <div className="lp-blob-wrap">
            <div className="lp-blob-layer lp-blob-0" />
            <div className="lp-blob-layer lp-blob-1" />
            <div className="lp-blob-layer lp-blob-2" />
            <div className="lp-blob-layer lp-blob-3" />
            <div className="lp-blob-layer lp-blob-4" />
            <div className="lp-blob-layer lp-blob-5" />
            <div className="lp-blob-fade" />
          </div>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 180 }}>

            {/* Title */}
            <h1 style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(56px, 11vw, 110px)',
              letterSpacing: '0.04em',
              color: '#f4f4f5',
              lineHeight: 0.95,
              margin: '0 0 14px',
            }}>
              AGRISWARM
            </h1>

            {/* Subtitle */}
            <p className="lp-mono" style={{
              fontSize: 11, letterSpacing: '0.22em',
              color: '#52525b', textTransform: 'uppercase', margin: '0 0 52px',
            }}>
              Farm Sustainability Platform
            </p>

            {/* CTA — shadcn Button with outline variant */}
            <div style={{
              opacity: ctaVisible ? 1 : 0,
              transform: ctaVisible ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}>
              <Button
                variant="outline"
                size="lg"
                className="lp-cta-btn lp-mono h-12 px-10 text-xs tracking-widest text-zinc-300 border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-500 gap-6"
                onClick={onEnter}
              >
                ENTER DASHBOARD
                <span className="lp-arrow text-zinc-500">→</span>
              </Button>
            </div>
          </div>

        </section>

        {/* ── PROBLEM ───────────────────────────────────────────────────── */}
        <section
          ref={setRef(0) as any}
          style={{ maxWidth: 680, margin: '0 auto', padding: '80px 24px 110px', textAlign: 'center', ...vis(0) }}
        >
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 700, color: '#f4f4f5', lineHeight: 1.18, marginBottom: 24 }}>
            40% of crop yield lost to{' '}
            <span style={{ color: '#a1a1aa' }}>invisible threats</span>
          </h2>
          <p style={{ fontSize: 15, color: '#52525b', lineHeight: 1.9 }}>
            Drought, pest activity, and terrain erosion strike silently — undetected until the damage is done.
            Traditional precision agriculture systems cost tens of thousands of dollars.
            Most small farms are flying blind with no affordable alternative.
          </p>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 110px', maxWidth: 1060, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 600, color: '#a1a1aa', marginBottom: 32, textAlign: 'center' }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 16 }}>
            {([
              { n: '01', title: 'Sense',   glyph: '◈', i: 1, desc: '5 sensors scan soil moisture, barometric pressure, temperature, terrain tilt, and acceleration every 5 seconds. No gap in coverage, no blind spots.' },
              { n: '02', title: 'Analyze', glyph: '⬡', i: 2, desc: 'Z-score anomaly detection, Pearson correlation matrices, and rule-based stress classification — patterns no single sensor could catch alone.' },
              { n: '03', title: 'Act',     glyph: '▶', i: 3, desc: 'The AI sustainability advisor generates a ranked action plan with environmental impact, cost, and timeline for every intervention.' },
            ] as const).map(card => (
              <div key={card.n} ref={setRef(card.i) as any} style={vis(card.i, (card.i - 1) * 140)}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                      <p className="text-2xl text-zinc-500">{card.glyph}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base font-semibold text-zinc-200 mb-2">{card.title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{card.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </section>

        {/* ── LIVE STATS ────────────────────────────────────────────────── */}
        <section
          ref={setRef(4) as any}
          style={{ padding: '0 24px 110px', maxWidth: 860, margin: '0 auto', ...vis(4) }}
        >
          <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 600, color: '#a1a1aa', marginBottom: 32, textAlign: 'center' }}>
            Live field data
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {([
              { label: 'TEMPERATURE',   value: stats.temp.toFixed(1), unit: '°C', bar: Math.min(1, Math.max(0, (stats.temp - 15) / 25)) },
              { label: 'SOIL MOISTURE', value: String(stats.soil),    unit: '%',  bar: stats.soil / 100 },
              { label: 'FIELD HEALTH',  value: String(stats.health),  unit: '',   bar: stats.health / 100 },
            ] as const).map(s => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <p className="lp-mono text-[9px] tracking-widest text-zinc-600 mb-3">{s.label}</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                    <span className="lp-mono" style={{ fontSize: 36, fontWeight: 700, color: '#a1a1aa', lineHeight: 1, transition: 'color 0.4s' }}>
                      {s.value}
                    </span>
                    <span className="lp-mono" style={{ fontSize: 13, color: '#3f3f46' }}>{s.unit}</span>
                  </div>
                  <div style={{ height: 1, background: '#27272a', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#52525b', width: `${s.bar * 100}%`, borderRadius: 1, transition: 'width 1.3s ease-out' }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── TECH STACK ────────────────────────────────────────────────── */}
        <section
          ref={setRef(5) as any}
          style={{ padding: '48px 24px', textAlign: 'center', ...vis(5) }}
        >
          <Separator className="mb-10 max-w-3xl mx-auto" />
          <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 600, color: '#a1a1aa', marginBottom: 24, textAlign: 'center' }}>
            Built with
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
            {['ESP32', 'BMP280', 'MPU6050', 'FSR402', 'React 18', 'TypeScript', 'WebSocket', 'Vite', 'Express', 'ngrok', 'Tailwind CSS'].map(tag => (
              <Badge key={tag} variant="outline" className="lp-mono text-[10px] tracking-wider text-zinc-600 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400 cursor-default">
                {tag}
              </Badge>
            ))}
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <footer style={{ padding: '28px 24px', textAlign: 'center' }}>
          <Separator className="max-w-3xl mx-auto" />
        </footer>

      </div>
    </>
  );
}
