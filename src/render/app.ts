import { applyAreaAppearance, applyTopBarAppearance } from '@/domain/appearance/style';
import type { AppearanceTarget, AreaAppearance } from '@/domain/appearance/types';
import { findArea } from '@/domain/layout/tree';
import { createDragController, type DragCommands } from '@/interact/drag';
import { currentLayer } from '@/store/selectors';
import type { AppStateReader } from '@/store/state';
import type { AppState } from '@/store/types';
import { applyTheme } from '@/theme/apply';
import { mountFractalBackground } from '@/theme/fractal-background';
import { revealWorkspace, SurfaceTransition } from '@/theme/motion';
import { mountScreenDepth } from '@/theme/screen-depth';
import { themes } from '@/theme/tokens';
import { h } from '@/utils/dom';
import { ContextMenu, type ContextMenuCommands, type ContextMenuView } from './context-menu';
import { layoutStructureKey, LayoutView, type MountedLayout } from './layout';
import { SettingsModal, type SettingsCommands } from './settings';
import { syncTopBar, TopBar, type TopBarCommands } from './topbar';

export interface DashboardCommands {
  topbar: TopBarCommands;
  menu: ContextMenuCommands;
  settings: SettingsCommands;
  layout: Pick<DragCommands, 'mergeArea' | 'replaceLayoutNode' | 'setSplitRatio'> & {
    openMenu: (areaId: string, x: number, y: number) => void;
  };
  overlay: {
    closeMenu: () => void;
    closeSettings: () => void;
  };
}

export interface AppRenderer {
  dismissMenu: () => void;
  dismissSettings: () => void;
  dispose: () => void;
}

function menuAppearance(state: AppState): AreaAppearance | null {
  const target = state.menu.target;
  if (!state.menu.open || !target) return null;
  if (target.kind === 'topbar') return state.topBarAppearance;
  return findArea(currentLayer(state).root, target.areaId)?.appearance ?? null;
}

/**
 * 顶层只负责组合长期存活的控制器。每个控制器通过 selector 订阅自己的状态切片，
 * 不再依赖手写 StateChange 路由；结构变化重建 Workspace，局部变化只更新所属组件。
 */
export function mountApp(
  root: HTMLElement,
  store: AppStateReader,
  commands: DashboardCommands,
): AppRenderer {
  const initialState = store.getState();
  const background = h('canvas', { class: 'app-background', ariaHidden: 'true' });
  const topbar = TopBar(initialState, commands.topbar);
  const layoutRoot = h('div', { class: 'layout-root' });
  const workspace = h('main', { class: 'workspace', id: 'workspace' }, layoutRoot);
  const menuLayer = h('div', { class: 'overlay-layer menu-layer' });
  const settingsLayer = h('div', { class: 'overlay-layer settings-layer' });
  const overlayRoot = h('div', { class: 'overlay-root' }, menuLayer, settingsLayer);
  const toast = h('div', { id: 'toast', class: 'toast', role: 'status' });
  const shell = h('div', { class: 'app-shell' }, topbar, workspace, overlayRoot, toast);
  // 动态投影层与普通浮层分开：拖拽预览属于曲面，菜单和设置始终属于屏幕平面。
  const projectionLayer = h('div', { class: 'projection-layer', ariaHidden: 'true' });
  const screenSurface = h('div', { class: 'screen-surface' }, background, shell, projectionLayer);

  root.replaceChildren(screenSurface);
  const disposeBackground = mountFractalBackground(background);
  const screenDepth = mountScreenDepth(screenSurface, initialState.screenDepth);
  const drag = createDragController(layoutRoot, {
    getLayout: () => currentLayer(store.getState()).root,
    mergeArea: commands.layout.mergeArea,
    replaceLayoutNode: commands.layout.replaceLayoutNode,
    setSplitRatio: commands.layout.setSplitRatio,
    setLayoutInteraction: screenDepth.setLayoutInteraction,
    getLogicalRect: screenDepth.getLogicalRect,
    screenToLayout: screenDepth.screenToLayout,
  }, {
    root: projectionLayer,
    registerSurface: screenDepth.registerSurface,
    setSurfaceRect: screenDepth.setSurfaceRect,
  });

  const disposers: Array<() => void> = [];
  let mountedLayout: MountedLayout | null = null;
  let menuView: ContextMenuView | null = null;
  let menuTransition: SurfaceTransition | null = null;
  let settingsTransition: SurfaceTransition | null = null;

  const previewAppearance = (target: AppearanceTarget, appearance: AreaAppearance): void => {
    if (target.kind === 'topbar') {
      applyTopBarAppearance(topbar, appearance);
      return;
    }
    const element = layoutRoot.querySelector<HTMLElement>(`[data-area="${target.areaId}"]`);
    if (element) applyAreaAppearance(element, appearance);
  };

  const renderWorkspace = (): void => {
    mountedLayout?.dispose();
    const state = store.getState();
    mountedLayout = LayoutView(currentLayer(state).root, {
      store,
      drag,
      openMenu: commands.layout.openMenu,
      geometryChanged: screenDepth.refreshSurfaces,
    });
    layoutRoot.replaceChildren(mountedLayout.element);
    mountedLayout.mount();
    revealWorkspace(mountedLayout.element);
    screenDepth.refreshSurfaces();
  };

  const syncMenu = (): void => {
    menuTransition?.dispose();
    menuTransition = null;
    menuView = null;
    menuLayer.replaceChildren();
    const next = ContextMenu(store.getState(), commands.menu, previewAppearance);
    if (!next) return;
    menuView = next;
    menuLayer.append(next.element);
    next.position();
    // 菜单包含以视口定位的 fixed 子菜单，根节点不能执行 transform 动画。
    menuTransition = new SurfaceTransition(next.element, { translatePanel: false });
    menuTransition.show();
  };

  const syncSettings = (): void => {
    settingsTransition?.dispose();
    settingsTransition = null;
    settingsLayer.replaceChildren();
    const state = store.getState();
    if (!state.settingsOpen) {
      // Escape 或遮罩关闭可能发生在 range 的 change 事件之前；关闭时必须丢弃未提交预览。
      layoutRoot.style.setProperty('--area-gap', `${state.areaGap}px`);
      screenDepth.update(state.screenDepth);
      return;
    }
    const modal = SettingsModal(
      state,
      dismissSettings,
      (value) => layoutRoot.style.setProperty('--area-gap', `${value}px`),
      screenDepth.update,
      commands.settings,
    );
    if (!modal) return;
    settingsLayer.append(modal);
    const panel = modal.querySelector<HTMLElement>('.settings-modal') ?? modal;
    settingsTransition = new SurfaceTransition(modal, {
      panel,
      enterDuration: 300,
      exitDuration: 200,
    });
    settingsTransition.show();
  };

  function dismissMenu(): void {
    if (!store.getState().menu.open) return;
    if (!menuTransition) {
      commands.overlay.closeMenu();
      return;
    }
    menuTransition.hide(commands.overlay.closeMenu);
  }

  function dismissSettings(): void {
    if (!store.getState().settingsOpen) return;
    if (!settingsTransition) {
      commands.overlay.closeSettings();
      return;
    }
    settingsTransition.hide(commands.overlay.closeSettings);
  }

  // 先订阅拓扑，再挂载子组件；Layer/分割变化时父订阅会先销毁旧 Area 的订阅。
  disposers.push(store.subscribeSlice(
    (state) => `${state.activeLayerId}:${layoutStructureKey(currentLayer(state).root)}`,
    renderWorkspace,
  ));
  renderWorkspace();

  applyTheme(themes[initialState.themeId]);
  disposers.push(store.subscribeSlice(
    (state) => state.themeId,
    (themeId) => applyTheme(themes[themeId]),
  ));

  layoutRoot.style.setProperty('--area-gap', `${initialState.areaGap}px`);
  disposers.push(store.subscribeSlice(
    (state) => state.areaGap,
    (areaGap) => {
      layoutRoot.style.setProperty('--area-gap', `${areaGap}px`);
      screenDepth.refreshSurfaces();
    },
  ));

  layoutRoot.classList.toggle('show-corner-hints', initialState.showCornerHints);
  disposers.push(store.subscribeSlice(
    (state) => state.showCornerHints,
    (visible) => layoutRoot.classList.toggle('show-corner-hints', visible),
  ));

  disposers.push(store.subscribeSlice(
    (state) => state.activeLayerId,
    () => syncTopBar(topbar, store.getState()),
  ));
  disposers.push(store.subscribeSlice(
    (state) => state.topBarAppearance,
    (appearance) => applyTopBarAppearance(topbar, appearance),
  ));
  disposers.push(store.subscribeSlice(
    (state) => state.screenDepth,
    screenDepth.update,
  ));
  disposers.push(store.subscribeSlice(
    (state) => state.menu.open || state.settingsOpen,
    screenDepth.setSuspended,
  ));

  syncMenu();
  disposers.push(store.subscribeSlice(
    (state) => state.menu,
    syncMenu,
  ));
  disposers.push(store.subscribeSlice(
    menuAppearance,
    (appearance) => {
      if (appearance) menuView?.sync(appearance);
    },
  ));

  syncSettings();
  disposers.push(store.subscribeSlice(
    (state) => state.settingsOpen,
    syncSettings,
  ));
  screenDepth.setSuspended(initialState.menu.open || initialState.settingsOpen);

  return {
    dismissMenu,
    dismissSettings,
    dispose: () => {
      for (const dispose of disposers) dispose();
      mountedLayout?.dispose();
      drag.dispose();
      disposeBackground();
      screenDepth.dispose();
      menuTransition?.dispose();
      settingsTransition?.dispose();
      root.replaceChildren();
    },
  };
}
