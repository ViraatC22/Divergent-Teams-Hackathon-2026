import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import type { AlertEntry } from '../types';
import { formatTimestamp, formatTimeAgo } from '../utils/formatters';
import { CLASSIFICATION_COLORS } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface Props { alerts: AlertEntry[]; }

export const AlertFeed: React.FC<Props> = ({ alerts }) => {
  const listRef    = useRef<HTMLDivElement>(null);
  const prevIdsRef = useRef<string[]>([]);

  // Slide-in new alert entries from the right
  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const newIds  = alerts.map(a => a.id).filter(id => !prevIds.includes(id));

    if (newIds.length > 0 && listRef.current) {
      // The newest alert is the first child
      const firstChild = listRef.current.firstElementChild as HTMLElement | null;
      if (firstChild) {
        gsap.fromTo(
          firstChild,
          { x: 80, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.38, ease: 'power2.out' },
        );
      }
    }

    prevIdsRef.current = alerts.map(a => a.id);
  }, [alerts]);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm">Alert Feed</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground italic">
            No alerts — system nominal
          </p>
        ) : (
          <div ref={listRef} className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {alerts.map(alert => {
              const isCritical  = alert.severity === 'critical';
              const persistSecs = Math.floor((Date.now() - alert.persistingSince) / 1000);

              return (
                <div
                  key={alert.id}
                  className={cn(
                    'alert-item rounded-md border p-3',
                    isCritical
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-amber-500/30 bg-amber-500/5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isCritical
                      ? <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                      : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={isCritical ? 'destructive' : 'warning'} className="text-[10px]">
                          {alert.severity}
                        </Badge>
                        <span className="text-xs font-semibold" style={{ color: CLASSIFICATION_COLORS[alert.label] }}>
                          {alert.label}
                        </span>
                        {/* Timestamp dimmed — it's metadata, not the message */}
                        <span className="ml-auto font-mono text-[10px]" style={{ opacity: 0.38 }}>
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-1">
                        {alert.recommendation}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {alert.triggers.join(' · ')}
                        </span>
                        {persistSecs > 30 && (
                          <span className={cn('font-mono text-[10px]', isCritical ? 'text-red-400' : 'text-amber-400')}>
                            {persistSecs}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
