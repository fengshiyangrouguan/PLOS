import { LAYER_PRESETS } from '@/config/layers';
import { TOPBAR_APPEARANCE } from '@/domain/appearance/defaults';
import { DEFAULT_SCREEN_DEPTH } from '@/domain/screen/types';
import { clone } from '@/utils/clone';
import { loadPersisted, persistNow, schedulePersist } from './persist';
import { pushHistory, redo as redoHistory, undo as undoHistory } from './history';
import {
  createSliceObserver,
  type EqualityFn,
  type Selector,
  type SliceListener,
} from './slice-subscription';
import type { AppState, LayerState } from './types';

type Listener = (state: AppState, previous: AppState) => void;
interface UpdateOptions { history?: boolean; persist?: boolean; }

/** 渲染模块只依赖该只读接口，不能从组件内部直接修改全局状态。 */
export interface AppStateReader {
  getState: () => AppState;
  subscribeSlice: <T>(
    selector: Selector<AppState, T>,
    listener: SliceListener<T>,
    equals?: EqualityFn<T>,
  ) => () => void;
}

function createDefaultState(): AppState {
  const layers: Record<string, LayerState> = {};
  for (const preset of LAYER_PRESETS) {
    const root = clone(preset.root);
    layers[preset.id] = { root };
  }
  return {
    activeLayerId: 'command', layers, areaGap: 8, showCornerHints: true,
    screenDepth: clone(DEFAULT_SCREEN_DEPTH),
    topBarAppearance: clone(TOPBAR_APPEARANCE),
    settingsOpen: false, menu: { open: false, x: 0, y: 0, target: null },
    themeId: 'light',
  };
}

function hydrateState(): AppState {
  const defaults = createDefaultState();
  const persisted = loadPersisted();
  if (!persisted) return defaults;
  // 只提取当前 Layer 模型声明的 root，同时清掉旧版本持久化数据中的废弃字段。
  const knownLayers = Object.fromEntries(Object.entries(persisted.layers)
    .filter(([id]) => id in defaults.layers)
    .map(([id, layer]) => [id, { root: layer.root }]));
  return {
    ...defaults,
    ...persisted,
    layers: { ...defaults.layers, ...knownLayers },
    screenDepth: { ...defaults.screenDepth, ...persisted.screenDepth },
    menu: defaults.menu,
    settingsOpen: false,
  };
}

let state = hydrateState();
const listeners = new Set<Listener>();

export function getState(): AppState { return state; }

export function setState(updater: Partial<AppState> | ((current: AppState) => AppState), options: UpdateOptions = {}): void {
  const previous = state;
  if (options.history) pushHistory(previous);
  const next = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  if (next === previous) return;
  state = next;
  if (options.persist !== false) schedulePersist(state);
  for (const listener of listeners) listener(state, previous);
}

export function replaceState(next: AppState): void {
  const previous = state;
  state = next;
  schedulePersist(state);
  for (const listener of listeners) listener(state, previous);
}

/**
 * Zustand 风格的切片订阅。组件声明自己读取的状态片段，Store 只在该片段真正变化时通知它。
 * selector 必须保持纯函数；高频鼠标、滑块预览和拖拽几何不应放入这里。
 */
export function subscribeSlice<T>(
  selector: Selector<AppState, T>,
  listener: SliceListener<T>,
  equals: EqualityFn<T> = Object.is,
): () => void {
  const observe = createSliceObserver(state, selector, listener, equals);
  const subscription: Listener = observe;
  listeners.add(subscription);
  return () => listeners.delete(subscription);
}

export const appStateReader: AppStateReader = { getState, subscribeSlice };

export function recordHistory(): void {
  pushHistory(state);
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
