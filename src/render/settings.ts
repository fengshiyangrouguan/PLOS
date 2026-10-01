import type { ScreenDepthSettings } from '@/domain/screen/types';
import type { AppState } from '@/store/types';
import { h } from '@/utils/dom';

export interface SettingsCommands {
  recordHistory: () => void;
  resetState: () => void;
  setAreaGap: (value: number) => void;
  setCornerHints: (value: boolean) => void;
  setScreenDepthAmount: (value: number) => void;
  setScreenDepthEnabled: (value: boolean) => void;
  setScreenFollowStrength: (value: number) => void;
}

export function SettingsModal(
  state: AppState,
  onRequestClose: () => void,
  onAreaGapPreview: (value: number) => void,
  onScreenDepthPreview: (settings: ScreenDepthSettings) => void,
  commands: SettingsCommands,
): HTMLElement | null {
  if (!state.settingsOpen) return null;
  let backdrop: HTMLDivElement;
  let gapTransactionStarted = false;
  const startGapTransaction = (): void => {
    if (gapTransactionStarted) return;
    gapTransactionStarted = true;
    commands.recordHistory();
  };
  const gapOutput = h('output', {}, `${state.areaGap}px`);
  const gapInput = h('input', {
    type: 'range', min: 0, max: 24, step: 1, value: state.areaGap,
    onPointerDown: startGapTransaction as EventListener,
    onKeyDown: startGapTransaction as EventListener,
    onInput: ((event: Event) => {
      startGapTransaction();
      const value = Number((event.target as HTMLInputElement).value);
      gapOutput.value = `${value}px`;
      // 预览只写 Workspace 根变量，由调用方持有具体 DOM，不扫描全局文档。
      onAreaGapPreview(value);
    }) as EventListener,
    onChange: ((event: Event) => {
      commands.setAreaGap(Number((event.target as HTMLInputElement).value));
      gapTransactionStarted = false;
    }) as EventListener,
  });

  /**
   * 屏幕纵深滑块在 input 阶段直接更新根 Surface；提交后只有纵深 selector 会收到变化，
   * 不会重建设置窗口或任何 Editor。一次连续拖动只记录一个撤销历史节点。
   */
  let previewSettings = { ...state.screenDepth };
  const screenRange = (
    label: string,
    key: 'depth' | 'followStrength',
    value: number,
    commit: (next: number) => void,
  ): HTMLElement => {
    let transactionStarted = false;
    const startTransaction = (): void => {
      if (transactionStarted) return;
      transactionStarted = true;
      commands.recordHistory();
    };
    const output = h('output', {}, `${value}%`);
    const input = h('input', {
      type: 'range', min: 0, max: 100, step: 1, value,
      onPointerDown: startTransaction as EventListener,
      onKeyDown: startTransaction as EventListener,
      onInput: ((event: Event) => {
        startTransaction();
        const next = Number((event.target as HTMLInputElement).value);
        output.value = `${next}%`;
        previewSettings = { ...previewSettings, [key]: next };
        onScreenDepthPreview(previewSettings);
      }) as EventListener,
      onChange: ((event: Event) => {
        commit(Number((event.target as HTMLInputElement).value));
        transactionStarted = false;
      }) as EventListener,
    });
    return h('div', { class: 'setting-row setting-subrow' },
      h('div', {}, h('strong', {}, label)),
      h('div', { class: 'setting-control' }, input, output),
    );
  };

  const depthOptions = h('div', {
    class: 'setting-suboptions',
    hidden: !state.screenDepth.enabled,
  },
    screenRange('曲面纵深', 'depth', state.screenDepth.depth, commands.setScreenDepthAmount),
    screenRange('鼠标跟随强度', 'followStrength', state.screenDepth.followStrength, commands.setScreenFollowStrength),
  );

  const depthToggle = h('input', {
    type: 'checkbox',
    checked: state.screenDepth.enabled,
    onChange: ((event: Event) => {
      const enabled = (event.target as HTMLInputElement).checked;
      depthOptions.hidden = !enabled;
      previewSettings = { ...previewSettings, enabled };
      onScreenDepthPreview(previewSettings);
      commands.setScreenDepthEnabled(enabled);
    }) as EventListener,
  });
  backdrop = h('div', {
    class: 'modal-backdrop visible',
    onPointerDown: ((event: PointerEvent) => {
      if (event.target === backdrop) onRequestClose();
    }) as unknown as EventListener,
  },
    h('section', { class: 'settings-modal', role: 'dialog', ariaLabel: '布局设置' },
      h('div', { class: 'modal-head' }, h('div', {}, h('span', {}, 'WORKSPACE / CONFIGURATION'), h('h2', {}, '布局设置')), h('button', { class: 'close-button', ariaLabel: '关闭设置', onClick: onRequestClose as EventListener }, h('span'))),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, 'Area 间隙')), h('div', { class: 'setting-control' }, gapInput, gapOutput)),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, '显示角点提示')), h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: state.showCornerHints, onChange: ((event: Event) => commands.setCornerHints((event.target as HTMLInputElement).checked)) as EventListener }), h('span'))),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, '屏幕曲面纵深')), h('label', { class: 'switch' }, depthToggle, h('span'))),
      depthOptions,
      h('div', { class: 'modal-foot' }, h('button', { class: 'reset-button', onClick: commands.resetState as EventListener }, '重置为默认'), h('button', { onClick: onRequestClose as EventListener }, '完成')),
    ),
  );
  return backdrop;
}
