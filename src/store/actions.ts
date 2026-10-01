import { LAYER_PRESETS } from '@/config/layers';
import { TOPBAR_APPEARANCE } from '@/domain/appearance/defaults';
import type { AppearanceTarget, AreaAppearance, BackgroundEffect } from '@/domain/appearance/types';
import type { EditorKind } from '@/domain/editor/types';
import { findArea, removeArea, replaceNode, updateArea, updateSplit } from '@/domain/layout/tree';
import type { LayoutNode } from '@/domain/layout/types';
import { DEFAULT_SCREEN_DEPTH } from '@/domain/screen/types';
import { clone } from '@/utils/clone';
import { clearHistory } from './history';
import { clearPersisted } from './persist';
import { getState, setState } from './state';

const CLOSED_MENU = { open: false, x: 0, y: 0, target: null } as const;

/**
 * 更新当前 Layer 时始终创建新的路径，不在 Store 内原地修改布局节点。
 * 这样一次交互只产生一个可追踪的状态事件，渲染器也能精确更新对应区域。
 */
function updateCurrentLayer(
  root: (current: LayoutNode) => LayoutNode,
  history = false,
): void {
  setState((state) => {
    const layer = state.layers[state.activeLayerId];
    const nextRoot = root(layer.root);
    if (nextRoot === layer.root) return state;
    return {
      ...state,
      layers: {
        ...state.layers,
        [state.activeLayerId]: { root: nextRoot },
      },
    };
  }, { history });
}

export function switchLayer(layerId: string): void {
  if (!(layerId in getState().layers) || layerId === getState().activeLayerId) return;
  setState({ activeLayerId: layerId, menu: CLOSED_MENU });
}

export function replaceLayoutNode(id: string, replacement: LayoutNode): void {
  updateCurrentLayer((root) => replaceNode(root, id, replacement), true);
}

export function mergeArea(sourceId: string, targetId: string): void {
  const state = getState();
  const source = findArea(state.layers[state.activeLayerId].root, sourceId);
  if (!source || sourceId === targetId) return;
  updateCurrentLayer(
    // sourceId 已在同一棵树中验证存在且不同于 targetId，因此删除 target 后不可能得到空树。
    (root) => removeArea(root, targetId)!,
    true,
  );
}

export function setEditor(areaId: string, editor: EditorKind): void {
  setState((state) => {
    const layer = state.layers[state.activeLayerId];
    // Editor 只是 Area 内的内容类型；切换内容时保留该 Area 已有的全部显示预设。
    const root = updateArea(layer.root, areaId, (area) => ({ ...area, editor }));
    if (root === layer.root) return state;
    return {
      ...state,
      layers: { ...state.layers, [state.activeLayerId]: { ...layer, root } },
      menu: CLOSED_MENU,
    };
  }, { history: true });
}

function updateTargetAppearance(
  target: AppearanceTarget,
  update: (appearance: AreaAppearance) => AreaAppearance,
  history = false,
): void {
  if (target.kind === 'topbar') {
    setState((state) => ({ ...state, topBarAppearance: update(state.topBarAppearance) }), {
      history,
    });
    return;
  }
  updateCurrentLayer(
    (root) => updateArea(root, target.areaId, (area) => ({ ...area, appearance: update(area.appearance) })),
    history,
  );
}

/** 提交已在 DOM 中预览过的单项外观值；该操作不会重建目标 Surface 或菜单。 */
export function commitAppearance(target: AppearanceTarget, key: keyof AreaAppearance, value: string | number | BackgroundEffect): void {
  updateTargetAppearance(target, (appearance) => ({ ...appearance, [key]: value }));
}

export function setBackgroundEffect(target: AppearanceTarget, effect: BackgroundEffect): void {
  updateTargetAppearance(target, (appearance) => ({ ...appearance, backgroundEffect: effect }), true);
}

export function setAreaGap(value: number): void {
  if (value === getState().areaGap) return;
  setState({ areaGap: value });
}

export function setSplitRatio(splitId: string, ratio: number): void {
  updateCurrentLayer((root) => updateSplit(root, splitId, ratio), true);
}

export function setCornerHints(value: boolean): void {
  if (value === getState().showCornerHints) return;
  setState({ showCornerHints: value });
}

export function setScreenDepthEnabled(enabled: boolean): void {
  if (enabled === getState().screenDepth.enabled) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, enabled },
  }), { history: true });
}

export function setScreenDepthAmount(depth: number): void {
  const value = Math.max(0, Math.min(100, depth));
  if (value === getState().screenDepth.depth) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, depth: value },
  }));
}

export function setScreenFollowStrength(followStrength: number): void {
  const value = Math.max(0, Math.min(100, followStrength));
  if (value === getState().screenDepth.followStrength) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, followStrength: value },
  }));
}

export function setSettingsOpen(value: boolean): void {
  if (value === getState().settingsOpen) return;
  setState({ settingsOpen: value }, { persist: false });
}

export function openMenu(areaId: string, x: number, y: number): void {
  setState({ menu: { open: true, target: { kind: 'area', areaId }, x, y } }, {
    persist: false,
  });
}

export function openTopBarMenu(x: number, y: number): void {
  setState({ menu: { open: true, target: { kind: 'topbar' }, x, y } }, {
    persist: false,
  });
}

export function closeMenu(): void {
  if (!getState().menu.open) return;
  setState({ menu: CLOSED_MENU }, { persist: false });
}

export function transparentBackground(target: AppearanceTarget): void {
  updateTargetAppearance(
    target,
    (appearance) => ({
      ...appearance,
      backgroundOpacity: 0,
      backgroundEffect: 'plain',
      backgroundBlur: 0,
      shadowOpacity: 0,
    }),
    true,
  );
}

export function transparentBorder(target: AppearanceTarget): void {
  updateTargetAppearance(
    target,
    (appearance) => ({ ...appearance, borderWidth: 0, borderOpacity: 0 }),
    true,
  );
}

export function resetState(): void {
  clearPersisted();
  clearHistory();
  const layers = Object.fromEntries(LAYER_PRESETS.map((preset) => {
    const root = clone(preset.root);
    return [preset.id, { root }];
  }));
  setState((state) => ({
    ...state,
    activeLayerId: 'command',
    layers,
    areaGap: 8,
    showCornerHints: true,
    screenDepth: clone(DEFAULT_SCREEN_DEPTH),
    topBarAppearance: clone(TOPBAR_APPEARANCE),
    menu: CLOSED_MENU,
    settingsOpen: false,
  }));
}
