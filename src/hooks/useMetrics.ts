import { useCallback } from 'react';

const SERVER = 'http://localhost:3001';

export function useMetrics(userId: string | null | undefined) {
  const logMetric = useCallback(async (
    metricType: string,
    metricValue: Record<string, unknown> = {},
  ) => {
    if (!userId) return;
    try {
      await fetch(`${SERVER}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, metricType, metricValue }),
      });
    } catch {
      // metrics are non-critical — fail silently
    }
  }, [userId]);

  const createNotification = useCallback(async (
    title: string,
    message: string,
    type: 'critical' | 'warning' | 'info',
  ) => {
    if (!userId) return;
    try {
      await fetch(`${SERVER}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, message, type }),
      });
    } catch {
      // non-critical — fail silently
    }
  }, [userId]);

  return { logMetric, createNotification };
}
