import { applyAreaAppearance, applyTopBarAppearance } from '@/domain/appearance/style';
import type {
  AppearanceTarget,
  AreaAppearance,
  BackgroundEffect,
  ShadowDirection,
  ShadowType,
} from '@/domain/appearance/types';
import { getAllEditors, getEditor } from '@/domain/editor/registry';
import { findArea } from '@/domain/layout/tree';
import {
  commitAppearance,
  setBackgroundEffect,
  setEditor,
  transparentBackground,
  transparentBorder,
} from '@/store/actions';
import { currentLayer } from '@/store/selectors';
import { getState, recordHistory } from '@/store/state';
import type { AppState } from '@/store/types';
import { h } from '@/utils/dom';
import { Slider } from './components/Slider';
import { EditorGlyph, UiGlyph } from './components/Glyph';
import {
  resolveContextMenuPlacement,
  resolveSubmenuPlacement,
  type MenuHorizontalDirection,
  type MenuVerticalDirection,
} from './context-menu-position';

export interface ContextMenuView {
  element: HTMLElement;
  position: () => void;
  sync: (appearance: AreaAppearance) => void;
}

function MenuItem(label: string, branch = false, onClick?: () => void): HTMLButtonElement {
  return h('button', {
    class: 'menu-item',
    onClick: onClick ? ((event: Event) => {
      event.stopPropagation();
      onClick();
    }) as EventListener : undefined,
  }, h('span', {}, label), branch ? UiGlyph('branch') : null);
}

function Branch(label: string, submenu: HTMLElement): HTMLElement {
  const branch = h('div', { class: 'menu-branch' }, MenuItem(label, true), submenu);

  const positionSubmenu = (): void => {
    // 窄屏使用固定底部面板，不参与桌面的级联定位。
    if (window.matchMedia('(max-width: 720px)').matches) return;
    const root = branch.closest<HTMLElement>('.context-menu');
    if (!root) return;

    // display:none 的节点没有可测尺寸。测量类只在当前同步任务内生效，不会形成可见闪烁。
    submenu.style.removeProperty('max-height');
    submenu.style.removeProperty('overflow-y');
    submenu.classList.add('is-measuring');
    const submenuWidth = submenu.offsetWidth;
    const submenuHeight = submenu.scrollHeight;
    const trigger = branch.getBoundingClientRect();
    const placement = resolveSubmenuPlacement(
      trigger,
      submenuWidth,
      submenuHeight,
      window.innerWidth,
      window.innerHeight,
      (root.dataset.menuHorizontal ?? 'right') as MenuHorizontalDirection,
      (root.dataset.menuVertical ?? 'down') as MenuVerticalDirection,
    );
    branch.dataset.submenuHorizontal = placement.horizontal;
    branch.dataset.submenuVertical = placement.vertical;
    if (submenuHeight > placement.availableHeight) {
      submenu.style.maxHeight = `${Math.floor(placement.availableHeight)}px`;
      submenu.style.overflowY = 'auto';
    }
    submenu.classList.remove('is-measuring');
  };

  branch.addEventListener('pointerenter', positionSubmenu);
  branch.addEventListener('focusin', positionSubmenu);
  return branch;
}

function targetAppearance(state: AppState, target: AppearanceTarget): AreaAppearance | null {
  if (target.kind === 'topbar') return state.topBarAppearance;
  return findArea(currentLayer(state).root, target.areaId)?.appearance ?? null;
}

/**
 * Area 和 Top Bar 都通过 AppearanceTarget 找到自己的长期存活节点。
 * Input 阶段只写目标节点的 CSS 变量；Change 阶段才提交 Store，因此两类 Editor
 * 使用完全相同的稳定预览事务，不会重建菜单或其他界面区域。
 */
function previewAppearance(
  target: AppearanceTarget,
  key: keyof AreaAppearance,
  value: string | number | BackgroundEffect,
): void {
  const appearance = targetAppearance(getState(), target);
  if (!appearance) return;
  const preview = { ...appearance, [key]: value };
  if (target.kind === 'topbar') {
    const element = document.querySelector<HTMLElement>('[data-editor="topbar"]');
    if (element) applyTopBarAppearance(element, preview);
    return;
  }
  const element = document.querySelector<HTMLElement>(`[data-area="${target.areaId}"]`);
  if (element) applyAreaAppearance(element, preview);
}

function appearanceSlider(
  target: AppearanceTarget,
  label: string,
  key: keyof AreaAppearance,
  value: number,
  min: number,
  max: number,
  step: number,
  suffix = '',
): HTMLElement {
  let previewFrame = 0;
  let previewValue = value;
  const schedulePreview = (next: number): void => {
    previewValue = next;
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      previewAppearance(target, key, previewValue);
    });
  };
  return Slider({
    appearanceKey: key,
    label,
    value,
    min,
    max,
    step,
    suffix,
    onStart: () => recordHistory(`修改 ${label}`),
    onInput: schedulePreview,
    onCommit: (next) => {
      if (previewFrame) cancelAnimationFrame(previewFrame);
      previewFrame = 0;
      previewAppearance(target, key, next);
      commitAppearance(target, key, next);
    },
  });
}

function colorControl(
  target: AppearanceTarget,
  label: string,
  key: 'borderColor' | 'backgroundColor',
  value: string,
): HTMLElement {
  let transactionStarted = false;
  const start = (): void => {
    if (transactionStarted) return;
    transactionStarted = true;
    recordHistory(`修改${label}`);
  };
  const input = h('input', {
    type: 'color',
    value,
    dataset: { appearanceKey: key },
    onPointerDown: start as EventListener,
    onInput: ((event: Event) => {
      start();
      previewAppearance(target, key, (event.target as HTMLInputElement).value);
    }) as EventListener,
    onChange: ((event: Event) => {
      commitAppearance(target, key, (event.target as HTMLInputElement).value);
      transactionStarted = false;
    }) as EventListener,
  });
  return h('label', { class: 'menu-color' }, h('span', {}, label), input);
}

function effectChoice(
  target: AppearanceTarget,
  effect: BackgroundEffect,
  label: string,
  active: boolean,
): HTMLButtonElement {
  return h('button', {
    class: 'menu-item effect-choice',
    dataset: { effect },
    ariaPressed: String(active),
    onClick: (() => setBackgroundEffect(target, effect)) as EventListener,
  }, h('span', { class: 'choice-mark', ariaHidden: 'true' }), h('span', {}, label));
}

function shadowChoice(
  target: AppearanceTarget,
  key: 'shadowType' | 'shadowDirection',
  value: ShadowType | ShadowDirection,
  label: string,
  active: boolean,
): HTMLButtonElement {
  return h('button', {
    class: 'menu-item effect-choice',
    dataset: { shadowKey: key, shadowValue: value },
    ariaPressed: String(active),
    onClick: (() => commitAppearance(target, key, value)) as EventListener,
  }, h('span', { class: 'choice-mark', ariaHidden: 'true' }), h('span', {}, label));
}

function syncControls(menu: HTMLElement, appearance: AreaAppearance): void {
  const values = appearance as unknown as Record<string, string | number>;
  menu.querySelectorAll<HTMLInputElement>('[data-appearance-key]').forEach((input) => {
    const key = input.dataset.appearanceKey;
    if (key && key in values) input.value = String(values[key]);
  });
  menu.querySelectorAll<HTMLOutputElement>('[data-appearance-output]').forEach((output) => {
    const key = output.dataset.appearanceOutput;
    if (key && key in values) output.value = `${values[key]}${output.dataset.suffix ?? ''}`;
  });
  menu.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.effect === appearance.backgroundEffect));
  });
  menu.querySelectorAll<HTMLButtonElement>('[data-shadow-key]').forEach((button) => {
    const key = button.dataset.shadowKey as 'shadowType' | 'shadowDirection' | undefined;
    if (!key) return;
    button.setAttribute('aria-pressed', String(button.dataset.shadowValue === appearance[key]));
  });
}

function AppearanceMenu(target: AppearanceTarget, appearance: AreaAppearance): HTMLElement {
  const borderMenu = h('div', { class: 'submenu border-menu' },
    h('div', { class: 'menu-caption' }, 'BORDER'),
    MenuItem('边线完全透明', false, () => transparentBorder(target)),
    appearanceSlider(target, '粗细', 'borderWidth', appearance.borderWidth, 0, 8, 1, 'px'),
    colorControl(target, '颜色', 'borderColor', appearance.borderColor),
    appearanceSlider(target, '透明度', 'borderOpacity', appearance.borderOpacity, 0, 1, .05),
    appearanceSlider(target, '圆角强度', 'radius', appearance.radius, 0, 24, 1, 'px'),
  );

  const effects = h('div', { class: 'submenu effect-menu' },
    h('div', { class: 'menu-caption' }, 'SURFACE EFFECT'),
    effectChoice(target, 'plain', '无效果', appearance.backgroundEffect === 'plain'),
    effectChoice(target, 'glass', '毛玻璃', appearance.backgroundEffect === 'glass'),
    effectChoice(target, 'frosted', '柔化磨砂', appearance.backgroundEffect === 'frosted'),
  );

  const shadowTypes = h('div', { class: 'submenu shadow-type-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW TYPE'),
    shadowChoice(target, 'shadowType', 'hard', '硬边', appearance.shadowType === 'hard'),
    shadowChoice(target, 'shadowType', 'blurred', '模糊', appearance.shadowType === 'blurred'),
  );

  const shadowDirections = h('div', { class: 'submenu shadow-direction-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW DIRECTION'),
    shadowChoice(target, 'shadowDirection', 'top', '上', appearance.shadowDirection === 'top'),
    shadowChoice(target, 'shadowDirection', 'top-right', '右上', appearance.shadowDirection === 'top-right'),
    shadowChoice(target, 'shadowDirection', 'right', '右', appearance.shadowDirection === 'right'),
    shadowChoice(target, 'shadowDirection', 'bottom-right', '右下', appearance.shadowDirection === 'bottom-right'),
    shadowChoice(target, 'shadowDirection', 'bottom', '下', appearance.shadowDirection === 'bottom'),
    shadowChoice(target, 'shadowDirection', 'bottom-left', '左下', appearance.shadowDirection === 'bottom-left'),
    shadowChoice(target, 'shadowDirection', 'left', '左', appearance.shadowDirection === 'left'),
    shadowChoice(target, 'shadowDirection', 'top-left', '左上', appearance.shadowDirection === 'top-left'),
  );

  const shadowMenu = h('div', { class: 'submenu shadow-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW'),
    Branch('类型', shadowTypes),
    Branch('方向', shadowDirections),
    appearanceSlider(target, '强度', 'shadowOpacity', appearance.shadowOpacity, 0, .5, .01),
    appearanceSlider(target, '大小', 'shadowSize', appearance.shadowSize, 0, 80, 1, 'px'),
  );

  const backgroundMenu = h('div', { class: 'submenu background-menu' },
    h('div', { class: 'menu-caption' }, 'BACKGROUND'),
    MenuItem('完全透明', false, () => transparentBackground(target)),
    appearanceSlider(target, '透明度', 'backgroundOpacity', appearance.backgroundOpacity, 0, 1, .05),
    appearanceSlider(target, '模糊度', 'backgroundBlur', appearance.backgroundBlur, 0, 40, 1, 'px'),
    colorControl(target, '颜色', 'backgroundColor', appearance.backgroundColor),
    Branch('背景效果', effects),
    Branch('阴影', shadowMenu),
  );

  return h('div', { class: 'submenu appearance-menu' },
    h('div', { class: 'menu-caption' }, 'DISPLAY PRESET'),
    Branch('边线', borderMenu),
    Branch('背景', backgroundMenu),
  );
}

export function ContextMenu(state: AppState): ContextMenuView | null {
  const target = state.menu.target;
  if (!state.menu.open || !target) return null;
  const appearance = targetAppearance(state, target);
  if (!appearance) return null;
  const menu = h('div', {
    class: 'context-menu',
    role: 'menu',
    style: { visibility: 'hidden' },
    onPointerDown: ((event: Event) => event.stopPropagation()) as EventListener,
    onClick: ((event: Event) => event.stopPropagation()) as EventListener,
  });

  const position = (): void => {
    const placement = resolveContextMenuPlacement(
      state.menu.x,
      state.menu.y,
      menu.offsetWidth,
      menu.offsetHeight,
      window.innerWidth,
      window.innerHeight,
    );
    menu.dataset.menuHorizontal = placement.horizontal;
    menu.dataset.menuVertical = placement.vertical;
    menu.style.left = `${placement.left}px`;
    menu.style.top = `${placement.top}px`;
    menu.style.removeProperty('right');
    menu.style.removeProperty('bottom');
    menu.style.removeProperty('visibility');
  };

  if (target.kind === 'topbar') {
    menu.append(
      h('div', { class: 'menu-caption' }, 'CHROME EDITOR / TOP BAR'),
      Branch('顶部栏显示预设', AppearanceMenu(target, appearance)),
    );
    return { element: menu, position, sync: (next) => syncControls(menu, next) };
  }

  const area = findArea(currentLayer(state).root, target.areaId);
  if (!area) return null;
  const editorMenu = h('div', { class: 'submenu editor-menu' }, h('div', { class: 'menu-caption' }, 'EDITOR TYPE'));
  for (const editor of getAllEditors()) {
    editorMenu.append(h('button', {
      class: 'menu-item editor-choice',
      ariaPressed: String(editor.kind === area.editor),
      onClick: (() => setEditor(area.id, editor.kind)) as EventListener,
    }, h('span', { class: 'choice-mark', ariaHidden: 'true' }), h('span', {}, editor.label), EditorGlyph(editor.kind)));
  }

  menu.append(
    h('div', { class: 'menu-caption' }, `AREA / ${getEditor(area.editor).label}`),
    Branch('显示仪表类型', editorMenu),
    Branch('Area 显示预设', AppearanceMenu(target, appearance)),
  );
  return { element: menu, position, sync: (next) => syncControls(menu, next) };
}
