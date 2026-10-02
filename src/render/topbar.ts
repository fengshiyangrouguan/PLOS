import { LAYER_PRESETS } from '@/config/layers';
import { applyTopBarAppearance } from '@/domain/appearance/style';
import type { AppState } from '@/store/types';
import { h } from '@/utils/dom';
import { UiGlyph } from './components/Glyph';

const TOPBAR_DEPTH_SEGMENTS = 9;
const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface TopBarCommands {
  switchLayer: (layerId: string) => void;
  openSettings: () => void;
  openMenu: (x: number, y: number) => void;
}

export interface TopBarView {
  /** 顶栏的根节点；外部只负责把它挂载到 App Shell。 */
  element: HTMLElement;
  /** 同步活动 Layer 和外观，不重建时钟节点。 */
  sync: (state: AppState) => void;
  /** 停止时钟更新，释放顶栏拥有的运行时资源。 */
  dispose: () => void;
}

function formatTime(): string {
  return TIME_FORMATTER.format(new Date());
}

function layerButton(
  id: string,
  label: string,
  shortLabel: string,
  state: AppState,
  commands: TopBarCommands,
): HTMLButtonElement {
  return h('button', {
    class: `layer-button ${id === state.activeLayerId ? 'active' : ''}`,
    ariaPressed: String(id === state.activeLayerId),
    dataset: { layerId: id, depthSurface: 'topbar-control' },
    onClick: (() => commands.switchLayer(id)) as EventListener,
  }, h('span', {}, label), h('small', {}, shortLabel));
}

/**
 * 顶栏横跨整个屏幕，单个四边形只能产生透视倾斜，无法表现连续的内凹弧线。
 * 这里预先生成九个等宽切片；投影控制器把每个切片视为曲面上的独立切平面，
 * 相邻切片共享投影边界，因此视觉上会拼成连续曲面而不会出现缩放整页的假象。
 */
function TopBarDepthMesh(): HTMLElement {
  return h('div', { class: 'topbar-depth-mesh', ariaHidden: 'true' },
    ...Array.from({ length: TOPBAR_DEPTH_SEGMENTS }, (_, index) => h('span', {
      class: 'topbar-depth-segment',
      dataset: { depthSurface: 'topbar-segment', segment: String(index) },
    })),
  );
}

/** 只同步 Layer 选中态，时钟与顶栏 DOM 不会因工作区切换而重建。 */
export function syncTopBar(element: HTMLElement, state: AppState): void {
  applyTopBarAppearance(element, state.topBarAppearance);
  element.querySelectorAll<HTMLButtonElement>('[data-layer-id]').forEach((button) => {
    const active = button.dataset.layerId === state.activeLayerId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

export function TopBar(state: AppState, commands: TopBarCommands): TopBarView {
  const left = LAYER_PRESETS.slice(0, 2);
  const right = LAYER_PRESETS.slice(2);
  const clock = h('time', {}, formatTime());
  const element = h('header', {
    class: 'topbar',
    dataset: { editor: 'topbar' },
    ariaLabel: '顶部控制栏 Editor',
    onContextMenu: ((event: MouseEvent) => {
      event.preventDefault();
      commands.openMenu(event.clientX, event.clientY);
    }) as unknown as EventListener,
  },
    TopBarDepthMesh(),
    h('div', { class: 'top-status left-status', dataset: { depthSurface: 'topbar-content' } }, h('span', { class: 'agent-light' }), h('strong', {}, 'ATLAS'), h('span', {}, 'Agent 执行中')),
    h('div', { class: 'brand', ariaLabel: 'Agent Dashboard', dataset: { depthSurface: 'topbar-content' } }, h('div', { class: 'brand-logo' }, 'A', h('span', {}, '·')), h('div', {}, h('span', {}, 'AGENT AREA'), h('strong', {}, 'NORTHSTAR'))),
    h('div', { class: 'top-status right-status', dataset: { depthSurface: 'topbar-content' } },
      h('span', { class: 'status-unit', title: '网络连接正常' }, UiGlyph('signal'), h('span', {}, 'LINK')),
      h('span', { class: 'status-unit', title: '电量 78%' }, UiGlyph('battery'), h('span', {}, '78%')),
      clock,
    ),
    h('div', { class: 'workspace-rail' },
      h('span', { class: 'rail-line', dataset: { depthSurface: 'topbar-control' } }),
      h('nav', { class: 'layer-group left', ariaLabel: '左侧工作区预设' }, ...left.map((layer) => layerButton(layer.id, layer.label, layer.shortLabel, state, commands))),
      h('button', { class: 'settings-button', title: '工作区设置', ariaLabel: '打开工作区设置', dataset: { depthSurface: 'topbar-control' }, onClick: commands.openSettings as EventListener }),
      h('nav', { class: 'layer-group right', ariaLabel: '右侧工作区预设' }, ...right.map((layer) => layerButton(layer.id, layer.label, layer.shortLabel, state, commands))),
      h('span', { class: 'rail-line', dataset: { depthSurface: 'topbar-control' } }),
    ),
  );
  applyTopBarAppearance(element, state.topBarAppearance);
  const clockTimer = window.setInterval(() => {
    clock.textContent = formatTime();
  }, 1000);
  return {
    element,
    sync: (nextState) => syncTopBar(element, nextState),
    dispose: () => window.clearInterval(clockTimer),
  };
}
