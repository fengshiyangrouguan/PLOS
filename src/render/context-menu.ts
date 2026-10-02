import type {
  AppearanceTarget,
  AreaAppearance,
  BackgroundEffect,
  ShadowDirection,
  ShadowType,
} from '@/domain/appearance/types';
import { getAllEditors, getEditor } from '@/domain/editor/registry';
import { findArea } from '@/domain/layout/tree';
import { currentLayer } from '@/store/selectors';
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

export interface ContextMenuCommands {
  commitAppearance: (
    target: AppearanceTarget,
    key: keyof AreaAppearance,
    value: string | number | BackgroundEffect,
  ) => void;
  recordHistory: () => void;
  setBackgroundEffect: (target: AppearanceTarget, effect: BackgroundEffect) => void;
  setEditor: (areaId: string, editor: string) => void;
  transparentBackground: (target: AppearanceTarget) => void;
  transparentBorder: (target: AppearanceTarget) => void;
}

interface AppearanceMenuView {
  element: HTMLElement;
  sync: (appearance: AreaAppearance) => void;
}

type AppearanceValue = string | number | BackgroundEffect;
type AppearancePreview = (key: keyof AreaAppearance, value: AppearanceValue) => void;

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
  return h('div', { class: 'menu-branch' }, MenuItem(label, true), submenu);
}

/**
 * 在根菜单仍不可见时一次性完成全部子菜单定位。
 *
 * 旧实现会在每一级 pointerenter 时把 display:none 的子菜单临时挂回布局，再交替读写
 * offsetWidth、scrollHeight、getBoundingClientRect 和 data 属性。深度越高，同步布局次数越多，
 * 所以用户会感到逐级累积的延迟。现在每一级子菜单都是独立的视口浮层；打开根菜单时按
 * DOM 层级从外到内完成定位，悬停热路径不再运行 JavaScript，也不会被父菜单滚动区裁剪。
 */
function positionSubmenus(root: HTMLElement): void {
  // 窄屏使用固定底部面板，不参与桌面的级联定位。
  if (window.matchMedia('(max-width: 720px)').matches) return;
  const branches = Array.from(root.querySelectorAll<HTMLElement>('.menu-branch'));
  const directSubmenu = (branch: HTMLElement): HTMLElement | undefined => Array.from(branch.children)
    .find((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('submenu'));

  // 先清除上一次视口计算留下的高度约束，保证 scrollHeight 表示完整内容高度。
  for (const branch of branches) {
    const submenu = directSubmenu(branch);
    submenu?.style.removeProperty('max-height');
    submenu?.style.removeProperty('overflow-y');
  }

  for (const branch of branches) {
    const submenu = directSubmenu(branch);
    if (!submenu) continue;
    const submenuHeight = submenu.scrollHeight;
    const placement = resolveSubmenuPlacement(
      branch.getBoundingClientRect(),
      submenu.offsetWidth,
      submenuHeight,
      window.innerWidth,
      window.innerHeight,
      (root.dataset.menuHorizontal ?? 'right') as MenuHorizontalDirection,
      (root.dataset.menuVertical ?? 'down') as MenuVerticalDirection,
    );
    submenu.style.left = `${placement.left}px`;
    submenu.style.top = `${placement.top}px`;
    submenu.style.removeProperty('right');
    submenu.style.removeProperty('bottom');
    if (submenuHeight > placement.availableHeight) {
      submenu.style.maxHeight = `${Math.floor(placement.availableHeight)}px`;
      submenu.style.overflowY = 'auto';
    }
  }
}

function targetAppearance(state: AppState, target: AppearanceTarget): AreaAppearance | null {
  if (target.kind === 'topbar') return state.topBarAppearance;
  return findArea(currentLayer(state).root, target.areaId)?.appearance ?? null;
}

function appearanceSlider(
  target: AppearanceTarget,
  label: string,
  key: keyof AreaAppearance,
  value: number,
  min: number,
  max: number,
  step: number,
  commands: ContextMenuCommands,
  previewAppearance: AppearancePreview,
  suffix = '',
): HTMLElement {
  let previewFrame = 0;
  let previewValue = value;
  const schedulePreview = (next: number): void => {
    previewValue = next;
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      previewAppearance(key, previewValue);
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
    onStart: commands.recordHistory,
    onInput: schedulePreview,
    onCommit: (next) => {
      if (previewFrame) cancelAnimationFrame(previewFrame);
      previewFrame = 0;
      previewAppearance(key, next);
      commands.commitAppearance(target, key, next);
    },
  });
}

function colorControl(
  target: AppearanceTarget,
  label: string,
  key: 'borderColor' | 'backgroundColor',
  value: string,
  commands: ContextMenuCommands,
  previewAppearance: AppearancePreview,
): HTMLElement {
  let transactionStarted = false;
  const start = (): void => {
    if (transactionStarted) return;
    transactionStarted = true;
    commands.recordHistory();
  };
  const input = h('input', {
    type: 'color',
    value,
    dataset: { appearanceKey: key },
    onPointerDown: start as EventListener,
    onInput: ((event: Event) => {
      start();
      previewAppearance(key, (event.target as HTMLInputElement).value);
    }) as EventListener,
    onChange: ((event: Event) => {
      commands.commitAppearance(target, key, (event.target as HTMLInputElement).value);
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
  commands: ContextMenuCommands,
): HTMLButtonElement {
  return h('button', {
    class: 'menu-item effect-choice',
    dataset: { effect },
    ariaPressed: String(active),
    onClick: (() => commands.setBackgroundEffect(target, effect)) as EventListener,
  }, h('span', { class: 'choice-mark', ariaHidden: 'true' }), h('span', {}, label));
}

function shadowChoice(
  target: AppearanceTarget,
  key: 'shadowType' | 'shadowDirection',
  value: ShadowType | ShadowDirection,
  label: string,
  active: boolean,
  commands: ContextMenuCommands,
): HTMLButtonElement {
  return h('button', {
    class: 'menu-item effect-choice',
    dataset: { shadowKey: key, shadowValue: value },
    ariaPressed: String(active),
    onClick: (() => commands.commitAppearance(target, key, value)) as EventListener,
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

function AppearanceMenu(
  target: AppearanceTarget,
  appearance: AreaAppearance,
  commands: ContextMenuCommands,
  onPreview: (target: AppearanceTarget, appearance: AreaAppearance) => void,
): AppearanceMenuView {
  let currentAppearance = appearance;
  const preview: AppearancePreview = (key, value) => {
    currentAppearance = { ...currentAppearance, [key]: value } as AreaAppearance;
    onPreview(target, currentAppearance);
  };
  const borderMenu = h('div', { class: 'submenu border-menu' },
    h('div', { class: 'menu-caption' }, 'BORDER'),
    MenuItem('边线完全透明', false, () => commands.transparentBorder(target)),
    appearanceSlider(target, '粗细', 'borderWidth', appearance.borderWidth, 0, 8, 1, commands, preview, 'px'),
    colorControl(target, '颜色', 'borderColor', appearance.borderColor, commands, preview),
    appearanceSlider(target, '透明度', 'borderOpacity', appearance.borderOpacity, 0, 1, .05, commands, preview),
    appearanceSlider(target, '圆角强度', 'radius', appearance.radius, 0, 24, 1, commands, preview, 'px'),
  );

  const effects = h('div', { class: 'submenu effect-menu' },
    h('div', { class: 'menu-caption' }, 'SURFACE EFFECT'),
    effectChoice(target, 'plain', '无效果', appearance.backgroundEffect === 'plain', commands),
    effectChoice(target, 'glass', '毛玻璃', appearance.backgroundEffect === 'glass', commands),
    effectChoice(target, 'frosted', '柔化磨砂', appearance.backgroundEffect === 'frosted', commands),
  );

  const shadowTypes = h('div', { class: 'submenu shadow-type-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW TYPE'),
    shadowChoice(target, 'shadowType', 'hard', '硬边', appearance.shadowType === 'hard', commands),
    shadowChoice(target, 'shadowType', 'blurred', '模糊', appearance.shadowType === 'blurred', commands),
  );

  const shadowDirections = h('div', { class: 'submenu shadow-direction-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW DIRECTION'),
    shadowChoice(target, 'shadowDirection', 'top', '上', appearance.shadowDirection === 'top', commands),
    shadowChoice(target, 'shadowDirection', 'top-right', '右上', appearance.shadowDirection === 'top-right', commands),
    shadowChoice(target, 'shadowDirection', 'right', '右', appearance.shadowDirection === 'right', commands),
    shadowChoice(target, 'shadowDirection', 'bottom-right', '右下', appearance.shadowDirection === 'bottom-right', commands),
    shadowChoice(target, 'shadowDirection', 'bottom', '下', appearance.shadowDirection === 'bottom', commands),
    shadowChoice(target, 'shadowDirection', 'bottom-left', '左下', appearance.shadowDirection === 'bottom-left', commands),
    shadowChoice(target, 'shadowDirection', 'left', '左', appearance.shadowDirection === 'left', commands),
    shadowChoice(target, 'shadowDirection', 'top-left', '左上', appearance.shadowDirection === 'top-left', commands),
  );

  const shadowMenu = h('div', { class: 'submenu shadow-menu' },
    h('div', { class: 'menu-caption' }, 'SHADOW'),
    Branch('类型', shadowTypes),
    Branch('方向', shadowDirections),
    appearanceSlider(target, '强度', 'shadowOpacity', appearance.shadowOpacity, 0, .5, .01, commands, preview),
    appearanceSlider(target, '大小', 'shadowSize', appearance.shadowSize, 0, 80, 1, commands, preview, 'px'),
  );

  const backgroundMenu = h('div', { class: 'submenu background-menu' },
    h('div', { class: 'menu-caption' }, 'BACKGROUND'),
    MenuItem('完全透明', false, () => commands.transparentBackground(target)),
    appearanceSlider(target, '透明度', 'backgroundOpacity', appearance.backgroundOpacity, 0, 1, .05, commands, preview),
    appearanceSlider(target, '模糊度', 'backgroundBlur', appearance.backgroundBlur, 0, 40, 1, commands, preview, 'px'),
    colorControl(target, '颜色', 'backgroundColor', appearance.backgroundColor, commands, preview),
    Branch('背景效果', effects),
    Branch('阴影', shadowMenu),
  );

  const element = h('div', { class: 'submenu appearance-menu' },
    h('div', { class: 'menu-caption' }, 'DISPLAY PRESET'),
    Branch('边线', borderMenu),
    Branch('背景', backgroundMenu),
  );
  return {
    element,
    sync: (next) => {
      currentAppearance = next;
      syncControls(element, next);
    },
  };
}

export function ContextMenu(
  state: AppState,
  commands: ContextMenuCommands,
  onPreview: (target: AppearanceTarget, appearance: AreaAppearance) => void,
): ContextMenuView | null {
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
    positionSubmenus(menu);
    menu.style.removeProperty('visibility');
  };

  const appearanceMenu = AppearanceMenu(target, appearance, commands, onPreview);

  if (target.kind === 'topbar') {
    menu.append(
      h('div', { class: 'menu-caption' }, 'CHROME EDITOR / TOP BAR'),
      Branch('顶部栏显示预设', appearanceMenu.element),
    );
    return { element: menu, position, sync: appearanceMenu.sync };
  }

  const area = findArea(currentLayer(state).root, target.areaId);
  if (!area) return null;
  const editorMenu = h('div', { class: 'submenu editor-menu' }, h('div', { class: 'menu-caption' }, 'EDITOR TYPE'));
  for (const editor of getAllEditors()) {
    editorMenu.append(h('button', {
      class: 'menu-item editor-choice',
      ariaPressed: String(editor.kind === area.editor),
      onClick: (() => commands.setEditor(area.id, editor.kind)) as EventListener,
    }, h('span', { class: 'choice-mark', ariaHidden: 'true' }), h('span', {}, editor.label), EditorGlyph(editor.kind)));
  }

  menu.append(
    h('div', { class: 'menu-caption' }, `AREA / ${getEditor(area.editor).label}`),
    Branch('显示仪表类型', editorMenu),
    Branch('Area 显示预设', appearanceMenu.element),
  );
  return { element: menu, position, sync: appearanceMenu.sync };
}
