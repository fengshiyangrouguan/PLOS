import { applyAreaAppearance } from '@/domain/appearance/style';
import { getEditor } from '@/domain/editor/registry';
import { findArea, findSplit } from '@/domain/layout/tree';
import type { AreaLeaf, Corner, LayoutNode } from '@/domain/layout/types';
import type { DragController } from '@/interact/drag';
import { currentLayer } from '@/store/selectors';
import type { AppStateReader } from '@/store/state';
import { revealContent } from '@/theme/motion';
import { h } from '@/utils/dom';
import { mountEditor } from './editors';

export interface MountedLayout {
  element: HTMLElement;
  mount: () => void;
  dispose: () => void;
}

export interface LayoutRuntime {
  store: AppStateReader;
  drag: DragController;
  openMenu: (areaId: string, x: number, y: number) => void;
  geometryChanged: () => void;
  /** 首次挂载当前 Layer 时，让每个 Area 内容播放一次进入动画。 */
  animateInitial: boolean;
}

function CornerHandles(areaId: string, areaElement: HTMLElement, drag: DragController): HTMLButtonElement[] {
  return (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as Corner[]).map((corner) => h('button', {
    class: `corner-handle ${corner}`,
    ariaLabel: `从 ${corner} 角拖动 Area`,
    onPointerDown: ((event: PointerEvent) => drag.startCornerDrag(event, areaId, corner, areaElement)) as unknown as EventListener,
  }));
}

function AreaView(initialArea: AreaLeaf, runtime: LayoutRuntime): MountedLayout {
  let area = initialArea;
  const definition = getEditor(area.editor);
  const element = h('article', {
    class: 'area',
    dataset: { area: area.id, editor: area.editor, depthSurface: 'area' },
    ariaLabel: `${definition.label} Area`,
    onContextMenu: ((event: MouseEvent) => {
      event.preventDefault();
      runtime.openMenu(area.id, event.clientX, event.clientY);
    }) as unknown as EventListener,
  });
  applyAreaAppearance(element, area.appearance);
  const content = h('div', { class: 'area-content' });
  element.append(content, ...CornerHandles(area.id, element, runtime.drag));

  let disposeEditor: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  const mountCurrentEditor = (animate = false): void => {
    disposeEditor?.();
    disposeEditor = mountEditor(content, area);
    element.dataset.editor = area.editor;
    element.setAttribute('aria-label', `${getEditor(area.editor).label} Area`);
    if (animate) revealContent(content);
  };

  return {
    element,
    mount: () => {
      mountCurrentEditor(runtime.animateInitial);
      unsubscribe = runtime.store.subscribeSlice(
        (state) => findArea(currentLayer(state).root, area.id),
        (next) => {
          if (!next) return;
          const editorChanged = next.editor !== area.editor;
          const appearanceChanged = next.appearance !== area.appearance;
          area = next;
          if (appearanceChanged) applyAreaAppearance(element, area.appearance);
          if (editorChanged) mountCurrentEditor(true);
        },
      );
    },
    dispose: () => {
      unsubscribe?.();
      disposeEditor?.();
    },
  };
}

export function LayoutView(node: LayoutNode, runtime: LayoutRuntime): MountedLayout {
  if (node.type === 'area') return AreaView(node, runtime);
  const element = h('div', { class: `split-node axis-${node.axis}`, dataset: { split: node.id } });
  element.style.setProperty('--split-ratio', `${node.ratio}%`);
  element.style.setProperty('--split-direction', node.axis === 'x' ? 'row' : 'column');
  /*
   * 布局间隙和拖拽命中面必须是两个不同概念：间隙可以为 0，但命中面仍要保持 12px，
   * 否则既无法被曲面投影器测量，也无法稳定接收指针事件。命中面作为独立 surface
   * 与相邻 Area 使用同一投影模型，因此视觉位置、实际命中位置和曲面纵深始终一致。
   */
  const dividerHandle = h('div', {
    class: 'split-divider-handle',
    role: 'separator',
    ariaLabel: '调整 Area 分割比例',
    ariaOrientation: node.axis === 'x' ? 'vertical' : 'horizontal',
    dataset: { depthSurface: 'split-divider' },
    onPointerDown: ((event: PointerEvent) => runtime.drag.startDividerDrag(event, node.id, node.axis, element)) as unknown as EventListener,
  });
  const divider = h('div', { class: 'split-divider' }, dividerHandle);
  const first = LayoutView(node.first, runtime);
  const second = LayoutView(node.second, runtime);
  element.append(
    h('div', { class: 'split-pane first' }, first.element),
    divider,
    h('div', { class: 'split-pane second' }, second.element),
  );
  let unsubscribe: (() => void) | null = null;
  return {
    element,
    mount: () => {
      first.mount();
      second.mount();
      unsubscribe = runtime.store.subscribeSlice(
        (state) => findSplit(currentLayer(state).root, node.id)?.ratio ?? null,
        (ratio) => {
          if (ratio === null) return;
          element.style.setProperty('--split-ratio', `${ratio}%`);
          runtime.geometryChanged();
        },
      );
    },
    dispose: () => {
      unsubscribe?.();
      first.dispose();
      second.dispose();
    },
  };
}

/** 结构签名只包含节点拓扑；比例、外观和 Editor 变化不会重建 Workspace。 */
export function layoutStructureKey(node: LayoutNode): string {
  if (node.type === 'area') return `a:${node.id}`;
  return `s:${node.id}:${node.axis}(${layoutStructureKey(node.first)})(${layoutStructureKey(node.second)})`;
}
