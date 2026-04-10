import { BUFFER_SIZE } from '../config';
import type { ChannelName, ChannelState } from '../types';
import { CHANNELS } from '../types';

export function makeEmptyChannelState(): ChannelState {
  return {
    buffer: [],
    zScore: 0,
    isAnomalous: false,
    lastAnomalyTime: 0,
    anomalyCount: 0,
    anomalyTimestamps: [],
  };
}

export function makeInitialChannelStates(): Record<ChannelName, ChannelState> {
  return Object.fromEntries(
    CHANNELS.map(ch => [ch, makeEmptyChannelState()])
  ) as Record<ChannelName, ChannelState>;
}

export function pushToBuffer(buffer: number[], value: number): number[] {
  const next = buffer.length >= BUFFER_SIZE
    ? buffer.slice(buffer.length - BUFFER_SIZE + 1)
    : buffer.slice();
  next.push(value);
  return next;
}
