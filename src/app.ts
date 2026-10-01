import { mountApp, type AppRenderer, type DashboardCommands } from '@/render/app';
import '@/render/editors';
import {
  closeMenu,
  commitAppearance,
  mergeArea,
  openMenu,
  openTopBarMenu,
  replaceLayoutNode,
  resetState,
  setAreaGap,
  setBackgroundEffect,
  setCornerHints,
  setEditor,
  setScreenDepthAmount,
  setScreenDepthEnabled,
  setScreenFollowStrength,
  setSettingsOpen,
  setSplitRatio,
  switchLayer,
  transparentBackground,
  transparentBorder,
} from '@/store/actions';
import { appStateReader, getState, recordHistory, redo, undo } from '@/store/state';
import { requiredElement } from '@/utils/dom';

export function startApp(): () => void {
  const root = requiredElement<HTMLElement>('#app');
  const commands: DashboardCommands = {
    topbar: {
      switchLayer,
      openSettings: () => setSettingsOpen(true),
      openMenu: openTopBarMenu,
    },
    menu: {
      commitAppearance,
      recordHistory,
      setBackgroundEffect,
      setEditor,
      transparentBackground,
      transparentBorder,
    },
    settings: {
      recordHistory,
      resetState,
      setAreaGap,
      setCornerHints,
      setScreenDepthAmount,
      setScreenDepthEnabled,
      setScreenFollowStrength,
    },
    layout: {
      mergeArea,
      replaceLayoutNode,
      setSplitRatio,
      openMenu,
    },
    overlay: {
      closeMenu,
      closeSettings: () => setSettingsOpen(false),
    },
  };
  const renderer: AppRenderer = mountApp(root, appStateReader, commands);

  const keyHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (getState().menu.open) renderer?.dismissMenu();
      else if (getState().settingsOpen) renderer?.dismissSettings();
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    }
    if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
      event.preventDefault();
      redo();
    }
  };
  window.addEventListener('keydown', keyHandler);

  /**
   * 外部点击只向菜单自己的生命周期控制器发出关闭请求。
   * 菜单内部已阻止事件冒泡，右键按下则留给随后到达的 contextmenu 更新菜单位置。
   */
  const menuDismissHandler = (event: PointerEvent): void => {
    if (event.button === 2 || !getState().menu.open) return;
    if (!(event.target as Element).closest?.('.context-menu')) renderer?.dismissMenu();
  };
  document.addEventListener('pointerdown', menuDismissHandler);

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const clockTimer = window.setInterval(() => {
    const clock = document.querySelector<HTMLTimeElement>('#clock');
    if (clock) clock.textContent = formatter.format(new Date());
  }, 1000);

  return () => {
    window.removeEventListener('keydown', keyHandler);
    document.removeEventListener('pointerdown', menuDismissHandler);
    window.clearInterval(clockTimer);
    renderer?.dispose();
  };
}
