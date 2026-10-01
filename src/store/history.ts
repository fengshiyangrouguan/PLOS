import type { AppState } from './types';
import { clone } from '@/utils/clone';

const MAX_HISTORY = 50;
const past: AppState[] = [];
const future: AppState[] = [];

export function pushHistory(state: AppState): void {
  past.push(clone(state));
  if (past.length > MAX_HISTORY) past.shift();
  future.length = 0;
}

export function undo(current: AppState): AppState | null {
  const previous = past.pop();
  if (!previous) return null;
  future.push(clone(current));
  return previous;
}

export function redo(current: AppState): AppState | null {
  const next = future.pop();
  if (!next) return null;
  past.push(clone(current));
  return next;
}

export function clearHistory(): void { past.length = 0; future.length = 0; }
