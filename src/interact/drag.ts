import { createSplit } from '@/domain/layout/factory';
import { findArea, findSplit } from '@/domain/layout/tree';
import type { AreaLeaf, Corner, CornerDragState, DividerDragState, LayoutNode, SplitAxis } from '@/domain/layout/types';
import { clone } from '@/utils/clone';
import { uid } from '@/utils/id';
import { findAdjacentArea } from './area-adjacency';

export interface DragCommands {
  getLayout: () => LayoutNode;
  mergeArea: (sourceId: string, targetId: string) => void;
  replaceLayoutNode: (id: string, replacement: LayoutNode) => void;
  setSplitRatio: (splitId: string, ratio: number) => void;
  setLayoutInteraction: (active: boolean) => void;
}

export interface DragController {
  startCornerDrag: (event: PointerEvent, areaId: string, corner: Corner, element: HTMLElement) => void;
  startDividerDrag: (event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement) => void;
  dispose: () => void;
}

// 角点需要越过明确死区才进入分割或合并，轻微点击和手抖不会创建新 Area。
const CORNER_DRAG_THRESHOLD = 24;

/**
 * 每个 Workspace 拥有独立拖拽控制器。控制器只在根节点内查找 Area，业务变更通过命令注入，
 * 因而不会与其他 Dashboard 实例共享状态，也不反向依赖全局 Store。
 */
export function createDragController(workspaceRoot: HTMLElement, commands: DragCommands): DragController {
  let cornerDrag: CornerDragState | null = null;
  let dividerDrag: DividerDragState | null = null;
  let moveFrame = 0;
  let latestPointer: { clientX: number; clientY: number } | null = null;
  let preview: HTMLDivElement | null = null;

  const previewElement = (): HTMLDivElement => {
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = 'split-preview';
    document.body.append(preview);
    return preview;
  };

  const removePreview = (): void => {
    preview?.remove();
    preview = null;
  };

  const showSplitPreview = (state: CornerDragState, event: { clientX: number; clientY: number }): void => {
    if (!state.axis) return;
    const element = previewElement();
    const { rect, axis, corner } = state;
    const firstSide = axis === 'x' ? corner.includes('left') : corner.includes('top');
    const x = Math.max(rect.left, Math.min(event.clientX, rect.right));
    const y = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
    if (axis === 'x') {
      element.style.cssText = `left:${firstSide ? rect.left : x}px;top:${rect.top}px;width:${firstSide ? x - rect.left : rect.right - x}px;height:${rect.height}px`;
    }
    else {
      element.style.cssText = `left:${rect.left}px;top:${firstSide ? rect.top : y}px;width:${rect.width}px;height:${firstSide ? y - rect.top : rect.bottom - y}px`;
    }
    element.className = `split-preview axis-${axis}`;
  };

  const showMergePreview = (targetId: string): void => {
    const target = workspaceRoot.querySelector<HTMLElement>(`[data-area="${targetId}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const element = previewElement();
    element.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    element.className = 'split-preview merge-preview';
  };

  const adjacentAreaAtPoint = (state: CornerDragState, x: number, y: number): string | null => {
    const candidates = Array.from(workspaceRoot.querySelectorAll<HTMLElement>('[data-area]'))
      .filter((element) => element.dataset.area !== state.areaId)
      .map((element) => ({ id: element.dataset.area!, rect: element.getBoundingClientRect() }));
    return findAdjacentArea(
      state.rect,
      { x: state.startX, y: state.startY },
      { x, y },
      candidates,
    );
  };

  const outsideSource = (state: CornerDragState, x: number, y: number): boolean => {
    const margin = 12;
    return x < state.rect.left - margin || x > state.rect.right + margin
      || y < state.rect.top - margin || y > state.rect.bottom + margin;
  };

  const cloneArea = (source: AreaLeaf): AreaLeaf => ({
    type: 'area',
    id: uid('area'),
    editor: source.editor,
    appearance: clone(source.appearance),
  });

  const commitCornerOperation = (state: CornerDragState): void => {
    if (state.mergeTargetId) {
      commands.mergeArea(state.areaId, state.mergeTargetId);
      return;
    }
    if (!state.axis) return;
    const source = findArea(commands.getLayout(), state.areaId);
    if (!source) return;
    const created = cloneArea(source);
    const fromFirstSide = state.axis === 'x' ? state.corner.includes('left') : state.corner.includes('top');
    const replacement = createSplit(
      uid('split'),
      state.axis,
      state.ratio,
      fromFirstSide ? created : source,
      fromFirstSide ? source : created,
    );
    commands.replaceLayoutNode(source.id, replacement);
  };

  const processPointerMove = (event: { clientX: number; clientY: number }): void => {
    if (cornerDrag) {
      const dx = event.clientX - cornerDrag.startX;
      const dy = event.clientY - cornerDrag.startY;
      if (Math.hypot(dx, dy) <= CORNER_DRAG_THRESHOLD) {
        cornerDrag.axis = null;
        cornerDrag.mergeTargetId = null;
        removePreview();
        return;
      }
      const outward = outsideSource(cornerDrag, event.clientX, event.clientY);
      const targetId = outward ? adjacentAreaAtPoint(cornerDrag, event.clientX, event.clientY) : null;
      if (targetId) {
        cornerDrag.axis = null;
        cornerDrag.mergeTargetId = targetId;
        showMergePreview(targetId);
        return;
      }
      cornerDrag.mergeTargetId = null;
      if (outward) {
        cornerDrag.axis = null;
        removePreview();
        return;
      }
      if (!cornerDrag.axis) cornerDrag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      const size = cornerDrag.axis === 'x' ? cornerDrag.rect.width : cornerDrag.rect.height;
      const position = cornerDrag.axis === 'x'
        ? event.clientX - cornerDrag.rect.left
        : event.clientY - cornerDrag.rect.top;
      const minRatio = Math.min(35, 140 / size * 100);
      cornerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
      showSplitPreview(cornerDrag, event);
      return;
    }
    if (dividerDrag) {
      const size = dividerDrag.axis === 'x' ? dividerDrag.rect.width : dividerDrag.rect.height;
      const position = dividerDrag.axis === 'x'
        ? event.clientX - dividerDrag.rect.left
        : event.clientY - dividerDrag.rect.top;
      const minRatio = Math.min(40, 140 / size * 100);
      dividerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
      dividerDrag.element.style.setProperty('--split-ratio', `${dividerDrag.ratio}%`);
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!cornerDrag && !dividerDrag) return;
    latestPointer = { clientX: event.clientX, clientY: event.clientY };
    if (moveFrame) return;
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      if (latestPointer) processPointerMove(latestPointer);
      latestPointer = null;
    });
  };

  const handlePointerUp = (): void => {
    if (moveFrame) cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    if (latestPointer) processPointerMove(latestPointer);
    latestPointer = null;
    if (cornerDrag) {
      removePreview();
      const completed = cornerDrag;
      cornerDrag = null;
      document.body.classList.remove('is-splitting');
      commands.setLayoutInteraction(false);
      if (completed.axis || completed.mergeTargetId) commitCornerOperation(completed);
    }
    if (dividerDrag) {
      const completed = dividerDrag;
      dividerDrag = null;
      document.body.classList.remove('resize-x', 'resize-y');
      commands.setLayoutInteraction(false);
      commands.setSplitRatio(completed.splitId, completed.ratio);
    }
  };

  const startCornerDrag = (event: PointerEvent, areaId: string, corner: Corner, element: HTMLElement): void => {
    event.preventDefault();
    event.stopPropagation();
    cornerDrag = {
      areaId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      rect: element.getBoundingClientRect(),
      axis: null,
      ratio: 50,
      mergeTargetId: null,
    };
    document.body.classList.add('is-splitting');
    commands.setLayoutInteraction(true);
  };

  const startDividerDrag = (event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement): void => {
    event.preventDefault();
    event.stopPropagation();
    const split = findSplit(commands.getLayout(), splitId);
    if (!split) return;
    dividerDrag = { splitId, axis, rect: element.getBoundingClientRect(), element, ratio: split.ratio };
    document.body.classList.add(axis === 'x' ? 'resize-x' : 'resize-y');
    commands.setLayoutInteraction(true);
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  return {
    startCornerDrag,
    startDividerDrag,
    dispose: () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (moveFrame) cancelAnimationFrame(moveFrame);
      moveFrame = 0;
      latestPointer = null;
      cornerDrag = null;
      dividerDrag = null;
      removePreview();
      document.body.classList.remove('is-splitting', 'resize-x', 'resize-y');
      commands.setLayoutInteraction(false);
    },
  };
}
