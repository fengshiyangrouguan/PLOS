import { applyAreaAppearance } from '@/domain/appearance/style';
import { getEditor } from '@/domain/editor/registry';
import type { EditorContext } from '@/domain/editor/context';
import type { AreaLeaf, Corner, LayoutNode } from '@/domain/layout/types';
import { startCornerDrag, startDividerDrag } from '@/interact/drag';
import { openMenu } from '@/store/actions';
import type { AppState } from '@/store/types';
import { h } from '@/utils/dom';
import { renderEditor } from './editors';

function CornerHandles(areaId: string, areaElement: HTMLElement): HTMLButtonElement[] {
  return (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as Corner[]).map((corner) => h('button', {
    class: `corner-handle ${corner}`,
    ariaLabel: `从 ${corner} 角拖动 Area`,
    onPointerDown: ((event: PointerEvent) => startCornerDrag(event, areaId, corner, areaElement)) as unknown as EventListener,
  }));
}

function AreaView(area: AreaLeaf, state: AppState, context: EditorContext): HTMLElement {
  const definition = getEditor(area.editor);
  const element = h('article', {
    class: `area ${state.showCornerHints ? 'show-corner-hints' : ''}`,
    dataset: { area: area.id, editor: area.editor, depthSurface: 'area' },
    ariaLabel: `${definition.label} Area`,
    onContextMenu: ((event: MouseEvent) => {
      event.preventDefault();
      openMenu(area.id, event.clientX, event.clientY);
    }) as unknown as EventListener,
  });
  applyAreaAppearance(element, area.appearance);
  if (area.editor !== 'empty') element.append(h('div', { class: 'area-content' }, renderEditor(area, context)));
  element.append(...CornerHandles(area.id, element));
  return element;
}

export function LayoutView(node: LayoutNode, state: AppState, context: EditorContext): HTMLElement {
  if (node.type === 'area') return AreaView(node, state, context);
  const element = h('div', { class: `split-node axis-${node.axis}`, dataset: { split: node.id } });
  element.style.setProperty('--split-ratio', `${node.ratio}%`);
  element.style.setProperty('--split-direction', node.axis === 'x' ? 'row' : 'column');
  element.style.setProperty('--area-gap', `${state.areaGap}px`);
  const divider = h('div', {
    class: 'split-divider', role: 'separator', ariaOrientation: node.axis === 'x' ? 'vertical' : 'horizontal',
    onPointerDown: ((event: PointerEvent) => startDividerDrag(event, node.id, node.axis, element)) as unknown as EventListener,
  });
  element.append(
    h('div', { class: 'split-pane first' }, LayoutView(node.first, state, context)),
    divider,
    h('div', { class: 'split-pane second' }, LayoutView(node.second, state, context)),
  );
  return element;
}
