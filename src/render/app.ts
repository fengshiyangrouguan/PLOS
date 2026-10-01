import { applyAreaAppearance, applyTopBarAppearance } from '@/domain/appearance/style';
import type { EditorContext } from '@/domain/editor/context';
import { findArea } from '@/domain/layout/tree';
import { closeMenu, setSettingsOpen } from '@/store/actions';
import { currentLayer } from '@/store/selectors';
import type { StateChange } from '@/store/state';
import type { AppState } from '@/store/types';
import { applyTheme } from '@/theme/apply';
import { mountFractalBackground } from '@/theme/fractal-background';
import { revealContent, SurfaceTransition } from '@/theme/motion';
import { mountScreenDepth } from '@/theme/screen-depth';
import { themes } from '@/theme/tokens';
import { h } from '@/utils/dom';
import { ContextMenu, type ContextMenuView } from './context-menu';
import { renderEditor, unmountEditor, unmountEditors } from './editors';
import { LayoutView } from './layout';
import { SettingsModal } from './settings';
import { syncTopBar, TopBar } from './topbar';

export interface AppRenderer {
  update: (state: AppState, previous: AppState, change: StateChange) => void;
  renderArea: (areaId: string) => void;
  dismissMenu: () => void;
  dismissSettings: () => void;
  dispose: () => void;
}

/**
 * 挂载一次应用骨架，之后按状态变更范围局部更新。
 * Top Bar、Workspace、菜单层和设置层拥有各自独立的 DOM 生命周期，任何一个控件的
 * 输入都不会再调用 root.replaceChildren，也不会让无关 Editor 反复卸载和挂载。
 */
export function mountApp(root: HTMLElement, initialState: AppState, context: EditorContext): AppRenderer {
  const background = h('canvas', { class: 'app-background', ariaHidden: 'true' });
  const topbar = TopBar(initialState);
  const layoutRoot = h('div', { class: 'layout-root' });
  const workspace = h('main', { class: 'workspace', id: 'workspace' }, layoutRoot);
  const menuLayer = h('div', { class: 'overlay-layer menu-layer' });
  const settingsLayer = h('div', { class: 'overlay-layer settings-layer' });
  const overlayRoot = h('div', { class: 'overlay-root' }, menuLayer, settingsLayer);
  const toast = h('div', { id: 'toast', class: 'toast', role: 'status' });
  const shell = h('div', { class: 'app-shell' }, topbar, workspace, overlayRoot, toast);
  const screenSurface = h('div', { class: 'screen-surface' }, background, shell);

  root.replaceChildren(screenSurface);
  const disposeBackground = mountFractalBackground(background);
  const screenDepth = mountScreenDepth(screenSurface, initialState.screenDepth);
  let state = initialState;
  let menuView: ContextMenuView | null = null;
  let menuTransition: SurfaceTransition | null = null;
  let settingsTransition: SurfaceTransition | null = null;

  const renderWorkspace = (): void => {
    unmountEditors();
    const content = LayoutView(currentLayer(state).root, state, context);
    layoutRoot.replaceChildren(content);
    layoutRoot.style.setProperty('--area-gap', `${state.areaGap}px`);
    revealContent(content);
    screenDepth.refreshSurfaces();
  };

  const syncGap = (): void => {
    layoutRoot.style.setProperty('--area-gap', `${state.areaGap}px`);
    layoutRoot.querySelectorAll<HTMLElement>('[data-split]').forEach((element) => {
      element.style.setProperty('--area-gap', `${state.areaGap}px`);
    });
    screenDepth.refreshSurfaces();
  };

  const syncCornerHints = (): void => {
    layoutRoot.querySelectorAll<HTMLElement>('[data-area]').forEach((element) => {
      element.classList.toggle('show-corner-hints', state.showCornerHints);
    });
  };

  const syncMenu = (): void => {
    menuTransition?.dispose();
    menuTransition = null;
    menuView = null;
    menuLayer.replaceChildren();
    const next = ContextMenu(state);
    if (!next) return;
    menuView = next;
    menuLayer.append(next.element);
    next.position();
    menuTransition = new SurfaceTransition(next.element);
    menuTransition.show();
  };

  const syncSettings = (): void => {
    settingsTransition?.dispose();
    settingsTransition = null;
    settingsLayer.replaceChildren();
    const modal = SettingsModal(state, dismissSettings, screenDepth.update);
    if (!modal) return;
    settingsLayer.append(modal);
    const panel = modal.querySelector<HTMLElement>('.settings-modal') ?? modal;
    settingsTransition = new SurfaceTransition(modal, panel, 300, 200);
    settingsTransition.show();
  };

  function dismissMenu(): void {
    if (!state.menu.open) return;
    if (!menuTransition) {
      closeMenu();
      return;
    }
    menuTransition.hide(closeMenu);
  }

  function dismissSettings(): void {
    if (!state.settingsOpen) return;
    if (!settingsTransition) {
      setSettingsOpen(false);
      return;
    }
    settingsTransition.hide(() => setSettingsOpen(false));
  }

  const renderArea = (areaId: string): void => {
    const area = findArea(currentLayer(state).root, areaId);
    const areaElement = layoutRoot.querySelector<HTMLElement>(`[data-area="${areaId}"]`);
    const content = areaElement?.querySelector<HTMLElement>('.area-content');
    if (!area || !content) return;
    unmountEditor(areaId);
    content.replaceChildren(renderEditor(area, context));
  };

  const update = (nextState: AppState, previous: AppState, change: StateChange): void => {
    state = nextState;
    // 浮层打开时冻结当前曲面，避免右键后背景突然回到中心位置。
    screenDepth.setSuspended(state.menu.open || state.settingsOpen);
    if (nextState.themeId !== previous.themeId || change.type === 'all') applyTheme(themes[nextState.themeId]);

    switch (change.type) {
      case 'appearance': {
        if (change.target.kind === 'topbar') {
          applyTopBarAppearance(topbar, state.topBarAppearance);
          menuView?.sync(state.topBarAppearance);
          break;
        }
        const area = findArea(currentLayer(state).root, change.target.areaId);
        const element = layoutRoot.querySelector<HTMLElement>(`[data-area="${change.target.areaId}"]`);
        if (area && element) {
          applyAreaAppearance(element, area.appearance);
          menuView?.sync(area.appearance);
        }
        break;
      }
      case 'menu':
        syncMenu();
        break;
      case 'settings':
        // 关闭设置时用已提交状态覆盖可能尚未提交的滑块预览值。
        screenDepth.update(state.screenDepth);
        syncSettings();
        break;
      case 'gap':
        syncGap();
        break;
      case 'screen-depth':
        screenDepth.update(state.screenDepth);
        break;
      case 'chrome':
        syncCornerHints();
        break;
      case 'geometry':
        // 拖动期间 DOM 已经得到最终比例；提交后只重新测量 Area 的曲面位置。
        screenDepth.refreshSurfaces();
        break;
      case 'layer':
        syncTopBar(topbar, state);
        renderWorkspace();
        syncMenu();
        break;
      case 'layout':
        renderWorkspace();
        syncMenu();
        break;
      case 'all':
        screenDepth.update(state.screenDepth);
        syncTopBar(topbar, state);
        renderWorkspace();
        syncMenu();
        syncSettings();
        break;
    }
  };

  applyTheme(themes[state.themeId]);
  renderWorkspace();
  syncMenu();
  syncSettings();
  screenDepth.setSuspended(state.menu.open || state.settingsOpen);

  return {
    update,
    renderArea,
    dismissMenu,
    dismissSettings,
    dispose: () => {
      disposeBackground();
      screenDepth.dispose();
      menuTransition?.dispose();
      settingsTransition?.dispose();
      unmountEditors();
      root.replaceChildren();
    },
  };
}
