import { LAYER_PRESETS } from '@/config/layers';
import { TOPBAR_APPEARANCE } from '@/domain/appearance/defaults';
import type { AppearanceTarget, AreaAppearance, BackgroundEffect } from '@/domain/appearance/types';
import type { EditorKind } from '@/domain/editor/types';
import { createArea } from '@/domain/layout/factory';
import { findArea, findFirstAreaId, removeArea, replaceNode, updateArea, updateSplit } from '@/domain/layout/tree';
import type { LayoutNode } from '@/domain/layout/types';
import { DEFAULT_SCREEN_DEPTH } from '@/domain/screen/types';
import { clone } from '@/utils/clone';
import { uid } from '@/utils/id';
import { clearHistory } from './history';
import { clearPersisted } from './persist';
import { getState, setState, type StateChange } from './state';

const CLOSED_MENU = { open: false, x: 0, y: 0, target: null } as const;

/**
 * 更新当前 Layer 时始终创建新的路径，不在 Store 内原地修改布局节点。
 * 这样一次交互只产生一个可追踪的状态事件，渲染器也能精确更新对应区域。
 */
function updateCurrentLayer(
  root: (current: LayoutNode) => LayoutNode,
  change: StateChange,
  historyLabel?: string,
  selectedAreaId?: string,
): void {
  setState((state) => {
    const layer = state.layers[state.activeLayerId];
    const nextRoot = root(layer.root);
    if (nextRoot === layer.root && selectedAreaId === undefined) return state;
    return {
      ...state,
      layers: {
        ...state.layers,
        [state.activeLayerId]: {
          root: nextRoot,
          selectedAreaId: selectedAreaId ?? layer.selectedAreaId,
        },
      },
    };
  }, { historyLabel, change });
}

export function switchLayer(layerId: string): void {
  if (!(layerId in getState().layers) || layerId === getState().activeLayerId) return;
  setState({ activeLayerId: layerId, menu: CLOSED_MENU }, { change: { type: 'layer' } });
}

export function replaceLayoutNode(id: string, replacement: LayoutNode, selectedId: string, label: string): void {
  updateCurrentLayer((root) => replaceNode(root, id, replacement), { type: 'layout' }, label, selectedId);
}

export function mergeArea(sourceId: string, targetId: string): void {
  const state = getState();
  const source = findArea(state.layers[state.activeLayerId].root, sourceId);
  if (!source || sourceId === targetId) return;
  updateCurrentLayer(
    (root) => removeArea(root, targetId) ?? createArea(uid('empty'), 'empty'),
    { type: 'layout' },
    '合并 Area',
    sourceId,
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
  }, { historyLabel: '切换 Editor', change: { type: 'layout' } });
}

function updateTargetAppearance(
  target: AppearanceTarget,
  update: (appearance: AreaAppearance) => AreaAppearance,
  historyLabel?: string,
): void {
  if (target.kind === 'topbar') {
    setState((state) => ({ ...state, topBarAppearance: update(state.topBarAppearance) }), {
      historyLabel,
      change: { type: 'appearance', target },
    });
    return;
  }
  updateCurrentLayer(
    (root) => updateArea(root, target.areaId, (area) => ({ ...area, appearance: update(area.appearance) })),
    { type: 'appearance', target },
    historyLabel,
  );
}

/** 提交已在 DOM 中预览过的单项外观值；该操作不会重建目标 Surface 或菜单。 */
export function commitAppearance(target: AppearanceTarget, key: keyof AreaAppearance, value: string | number | BackgroundEffect): void {
  updateTargetAppearance(target, (appearance) => ({ ...appearance, [key]: value }));
}

export function setBackgroundEffect(target: AppearanceTarget, effect: BackgroundEffect): void {
  updateTargetAppearance(target, (appearance) => ({ ...appearance, backgroundEffect: effect }), '修改背景效果');
}

export function setAreaGap(value: number): void {
  if (value === getState().areaGap) return;
  setState({ areaGap: value }, { change: { type: 'gap' } });
}

export function setSplitRatio(splitId: string, ratio: number): void {
  updateCurrentLayer((root) => updateSplit(root, splitId, ratio), { type: 'geometry' }, '调整 Area 尺寸');
}

export function setCornerHints(value: boolean): void {
  if (value === getState().showCornerHints) return;
  setState({ showCornerHints: value }, { change: { type: 'chrome' } });
}

export function setScreenDepthEnabled(enabled: boolean): void {
  if (enabled === getState().screenDepth.enabled) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, enabled },
  }), { historyLabel: enabled ? '开启屏幕纵深' : '关闭屏幕纵深', change: { type: 'screen-depth' } });
}

export function setScreenDepthAmount(depth: number): void {
  const value = Math.max(0, Math.min(100, depth));
  if (value === getState().screenDepth.depth) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, depth: value },
  }), { change: { type: 'screen-depth' } });
}

export function setScreenFollowStrength(followStrength: number): void {
  const value = Math.max(0, Math.min(100, followStrength));
  if (value === getState().screenDepth.followStrength) return;
  setState((state) => ({
    ...state,
    screenDepth: { ...state.screenDepth, followStrength: value },
  }), { change: { type: 'screen-depth' } });
}

export function setSettingsOpen(value: boolean): void {
  if (value === getState().settingsOpen) return;
  setState({ settingsOpen: value }, { persist: false, change: { type: 'settings' } });
}

export function openMenu(areaId: string, x: number, y: number): void {
  setState((state) => {
    const layer = state.layers[state.activeLayerId];
    return {
      ...state,
      layers: {
        ...state.layers,
        [state.activeLayerId]: { ...layer, selectedAreaId: areaId },
      },
      menu: { open: true, target: { kind: 'area', areaId }, x, y },
    };
  }, { persist: false, change: { type: 'menu' } });
}

export function openTopBarMenu(x: number, y: number): void {
  setState({ menu: { open: true, target: { kind: 'topbar' }, x, y } }, {
    persist: false,
    change: { type: 'menu' },
  });
}

export function closeMenu(): void {
  if (!getState().menu.open) return;
  setState({ menu: CLOSED_MENU }, { persist: false, change: { type: 'menu' } });
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
    '背景完全透明',
  );
}

export function transparentBorder(target: AppearanceTarget): void {
  updateTargetAppearance(
    target,
    (appearance) => ({ ...appearance, borderWidth: 0, borderOpacity: 0 }),
    '边线完全透明',
  );
}

export function resetState(): void {
  clearPersisted();
  clearHistory();
  const layers = Object.fromEntries(LAYER_PRESETS.map((preset) => {
    const root = clone(preset.root);
    return [preset.id, { root, selectedAreaId: findFirstAreaId(root) }];
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
  }), { change: { type: 'all' } });
}
