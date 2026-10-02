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
      switchLayer: switchLayer,
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
    //TODO: 如果用户正在输入框里输入，Ctrl+Z 应该撤销输入，而不是撤销应用状态。加一个检查
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

  return () => {
    window.removeEventListener('keydown', keyHandler);
    renderer?.dispose();
  };
}
