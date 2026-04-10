import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';

const SERVER = 'http://localhost:3001';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'warning' | 'info';
  is_read: boolean;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#22c55e',
};

interface Props {
  userId: string;
}

export const NotificationBell: React.FC<Props> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]                   = useState(false);
  const dropdownRef                       = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch(`${SERVER}/api/notifications/${userId}`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore fetch errors
    }
  }, [userId]);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await fetch(`${SERVER}/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n),
      );
    } catch { /* non-critical */ }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          cursor: 'pointer',
          color: unreadCount > 0 ? '#22c55e' : '#52525b',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
        aria-label="Notifications"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16,
            background: '#22c55e',
            borderRadius: 9999,
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 38, right: 0,
          width: 320,
          background: '#111116',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: '#71717a', textTransform: 'uppercase' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#22c55e' }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{
                padding: '24px 14px', textAlign: 'center',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12,
                color: '#52525b', fontStyle: 'italic',
              }}>
                No notifications yet
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: n.is_read ? 'default' : 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.02)',
                    transition: 'background 0.15s',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => {
                    if (!n.is_read) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'transparent' : 'rgba(255,255,255,0.02)';
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: n.is_read ? '#27272a' : TYPE_COLORS[n.type] ?? '#22c55e',
                    flexShrink: 0, marginTop: 4,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
                      color: n.is_read ? '#52525b' : '#e4e4e7',
                      marginBottom: 2,
                    }}>
                      {n.title}
                    </div>
                    <div style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: 11,
                      color: '#52525b', lineHeight: 1.5,
                    }}>
                      {n.message}
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                      color: '#3f3f46', marginTop: 4, opacity: 0.6,
                    }}>
                      {new Date(n.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
