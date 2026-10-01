import { LAYER_PRESETS } from '@/config/layers';
import { TOPBAR_APPEARANCE } from '@/domain/appearance/defaults';
import type { AppearanceTarget } from '@/domain/appearance/types';
import { findFirstAreaId } from '@/domain/layout/tree';
import { DEFAULT_SCREEN_DEPTH } from '@/domain/screen/types';
import { clone } from '@/utils/clone';
import { loadPersisted, persistNow, schedulePersist } from './persist';
import { pushHistory, redo as redoHistory, undo as undoHistory } from './history';
import type { AppState, LayerState } from './types';

/**
 * 状态变更的语义范围。
 * 渲染器根据该信息更新对应的长期存活节点，避免一个滑块导致整个应用销毁重建。
 */
export type StateChange =
  | { type: 'all' }
  | { type: 'layer' }
  | { type: 'layout' }
  | { type: 'geometry' }
  | { type: 'appearance'; target: AppearanceTarget }
  | { type: 'menu' }
  | { type: 'settings' }
  | { type: 'gap' }
  | { type: 'screen-depth' }
  | { type: 'chrome' };

type Listener = (state: AppState, previous: AppState, change: StateChange) => void;
interface UpdateOptions { historyLabel?: string; persist?: boolean; change?: StateChange; }

function createDefaultState(): AppState {
  const layers: Record<string, LayerState> = {};
  for (const preset of LAYER_PRESETS) {
    const root = clone(preset.root);
    layers[preset.id] = { root, selectedAreaId: findFirstAreaId(root) };
  }
  return {
    activeLayerId: 'command', layers, areaGap: 8, showCornerHints: true,
    screenDepth: clone(DEFAULT_SCREEN_DEPTH),
    topBarAppearance: clone(TOPBAR_APPEARANCE),
    settingsOpen: false, menu: { open: false, x: 0, y: 0, target: null },
    themeId: 'light', syncStatus: 'idle',
  };
}

function hydrateState(): AppState {
  const defaults = createDefaultState();
  const persisted = loadPersisted();
  if (!persisted) return defaults;
  const knownLayers = Object.fromEntries(Object.entries(persisted.layers).filter(([id]) => id in defaults.layers));
  return {
    ...defaults,
    ...persisted,
    layers: { ...defaults.layers, ...knownLayers },
    screenDepth: { ...defaults.screenDepth, ...persisted.screenDepth },
    menu: defaults.menu,
    settingsOpen: false,
    syncStatus: 'idle',
  };
}

let state = hydrateState();
const listeners = new Set<Listener>();

export function getState(): AppState { return state; }

export function setState(updater: Partial<AppState> | ((current: AppState) => AppState), options: UpdateOptions = {}): void {
  const previous = state;
  if (options.historyLabel) pushHistory(previous, options.historyLabel);
  const next = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  if (next === previous) return;
  state = next;
  if (options.persist !== false) schedulePersist(state);
  const change = options.change ?? { type: 'all' };
  for (const listener of listeners) listener(state, previous, change);
}

export function replaceState(next: AppState): void {
  const previous = state;
  state = next;
  schedulePersist(state);
  for (const listener of listeners) listener(state, previous, { type: 'all' });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordHistory(label: string): void {
  pushHistory(state, label);
}

export function undo(): boolean {
  const previous = undoHistory(state);
  if (!previous) return false;
  replaceState(previous);
  return true;
}

export function redo(): boolean {
  const next = redoHistory(state);
  if (!next) return false;
  replaceState(next);
  return true;
}

window.addEventListener('beforeunload', () => persistNow(state));
