import type { AppState } from './types';
import { clone } from '@/utils/clone';

interface HistoryEntry { state: AppState; label: string; timestamp: number; }
const MAX_HISTORY = 50;
const past: HistoryEntry[] = [];
const future: HistoryEntry[] = [];

export function pushHistory(state: AppState, label: string): void {
  past.push({ state: clone(state), label, timestamp: Date.now() });
  if (past.length > MAX_HISTORY) past.shift();
  future.length = 0;
}

export function undo(current: AppState): AppState | null {
  const entry = past.pop();
  if (!entry) return null;
  future.push({ state: clone(current), label: entry.label, timestamp: Date.now() });
  return entry.state;
}

export function redo(current: AppState): AppState | null {
  const entry = future.pop();
  if (!entry) return null;
  past.push({ state: clone(current), label: entry.label, timestamp: Date.now() });
  return entry.state;
}

export function clearHistory(): void { past.length = 0; future.length = 0; }
