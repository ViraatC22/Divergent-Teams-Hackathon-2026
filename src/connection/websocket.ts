import type { SensorPacket } from '../types';
import { parsePacket } from '../types';
import { RECONNECT_INTERVAL_MS } from '../config';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface WSManagerOptions {
  url: string;
  onPacket: (packet: SensorPacket) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export class WSManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private opts: WSManagerOptions;

  constructor(opts: WSManagerOptions) {
    this.opts = opts;
    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.opts.onStatusChange('connected');
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      const packet = parsePacket(String(evt.data));
      if (packet) this.opts.onPacket(packet);
    };

    this.ws.onclose = () => {
      if (!this.destroyed) {
        this.opts.onStatusChange('reconnecting');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, RECONNECT_INTERVAL_MS);
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.opts.onStatusChange('disconnected');
  }
}
