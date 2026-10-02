import { createSplit } from '@/domain/layout/factory';
import { findArea, findSplit } from '@/domain/layout/tree';
import type { AreaLeaf, Corner, CornerDragState, DividerDragState, LayoutNode, SplitAxis } from '@/domain/layout/types';
import { clone } from '@/utils/clone';
import { uid } from '@/utils/id';
import { findAdjacentArea } from './area-adjacency';
import {
  createDragPreviewController,
  type PreviewProjectionBridge,
} from './drag-preview';

export interface DragCommands {
  getLayout: () => LayoutNode;
  mergeArea: (sourceId: string, targetId: string) => void;
  replaceLayoutNode: (id: string, replacement: LayoutNode) => void;
  setSplitRatio: (splitId: string, ratio: number) => void;
  setLayoutInteraction: (active: boolean) => void;
  getLogicalRect: (element: HTMLElement) => DOMRect;
  screenToLayout: (point: { x: number; y: number }) => { x: number; y: number };
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
export function createDragController(
  workspaceRoot: HTMLElement,
  commands: DragCommands,
  previewBridge: PreviewProjectionBridge,
): DragController {
  let cornerDrag: CornerDragState | null = null;
  let dividerDrag: DividerDragState | null = null;
  let moveFrame = 0;
  let latestPointer: { x: number; y: number } | null = null;
  const preview = createDragPreviewController(previewBridge);

  const showMergePreview = (targetId: string): void => {
    const target = workspaceRoot.querySelector<HTMLElement>(`[data-area="${targetId}"]`);
    if (!target) return;
    const rect = commands.getLogicalRect(target);
    preview.showMerge(targetId, rect);
  };

  const adjacentAreaAtPoint = (state: CornerDragState, x: number, y: number): string | null => {
    const candidates = Array.from(workspaceRoot.querySelectorAll<HTMLElement>('[data-area]'))
      .filter((element) => element.dataset.area !== state.areaId)
      .map((element) => ({ id: element.dataset.area!, rect: commands.getLogicalRect(element) }));
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

  const processPointerMove = (pointer: { x: number; y: number }): void => {
    if (cornerDrag) {
      const dx = pointer.x - cornerDrag.startX;
      const dy = pointer.y - cornerDrag.startY;
      if (Math.hypot(dx, dy) <= CORNER_DRAG_THRESHOLD) {
        cornerDrag.axis = null;
        cornerDrag.mergeTargetId = null;
        preview.hide();
        return;
      }
      const outward = outsideSource(cornerDrag, pointer.x, pointer.y);
      const targetId = outward ? adjacentAreaAtPoint(cornerDrag, pointer.x, pointer.y) : null;
      if (targetId) {
        cornerDrag.axis = null;
        cornerDrag.mergeTargetId = targetId;
        showMergePreview(targetId);
        return;
      }
      cornerDrag.mergeTargetId = null;
      if (outward) {
        cornerDrag.axis = null;
        preview.hide();
        return;
      }
      if (!cornerDrag.axis) cornerDrag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      const size = cornerDrag.axis === 'x' ? cornerDrag.rect.width : cornerDrag.rect.height;
      const position = cornerDrag.axis === 'x'
        ? pointer.x - cornerDrag.rect.left
        : pointer.y - cornerDrag.rect.top;
      const minRatio = Math.min(35, 140 / size * 100);
      cornerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
      preview.showSplit(cornerDrag.rect, cornerDrag.axis, cornerDrag.corner, pointer);
      return;
    }
    if (dividerDrag) {
      const size = dividerDrag.axis === 'x' ? dividerDrag.rect.width : dividerDrag.rect.height;
      const position = dividerDrag.axis === 'x'
        ? pointer.x - dividerDrag.logicalOffset - dividerDrag.rect.left
        : pointer.y - dividerDrag.logicalOffset - dividerDrag.rect.top;
      const minRatio = Math.min(40, 140 / size * 100);
      dividerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
      dividerDrag.element.style.setProperty('--split-ratio', `${dividerDrag.ratio}%`);
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!cornerDrag && !dividerDrag) return;
    latestPointer = commands.screenToLayout({ x: event.clientX, y: event.clientY });
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
      preview.hide();
      const completed = cornerDrag;
      cornerDrag = null;
      document.body.classList.remove('is-splitting');
      if (completed.axis || completed.mergeTargetId) commitCornerOperation(completed);
      // 新布局和新 surface 已经注册完成后再恢复曲率，避免旧 surface 参与恢复首帧。
      commands.setLayoutInteraction(false);
    }
    if (dividerDrag) {
      const completed = dividerDrag;
      dividerDrag = null;
      document.body.classList.remove('resize-x', 'resize-y');
      commands.setSplitRatio(completed.splitId, completed.ratio);
      commands.setLayoutInteraction(false);
    }
  };

  const startCornerDrag = (event: PointerEvent, areaId: string, corner: Corner, element: HTMLElement): void => {
    event.preventDefault();
    event.stopPropagation();
    const pointer = commands.screenToLayout({ x: event.clientX, y: event.clientY });
    const rect = commands.getLogicalRect(element);
    commands.setLayoutInteraction(true);
    cornerDrag = {
      areaId,
      corner,
      startX: pointer.x,
      startY: pointer.y,
      rect,
      axis: null,
      ratio: 50,
      mergeTargetId: null,
    };
    document.body.classList.add('is-splitting');
  };

  const startDividerDrag = (event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement): void => {
    event.preventDefault();
    event.stopPropagation();
    const split = findSplit(commands.getLayout(), splitId);
    if (!split) return;
    const pointer = commands.screenToLayout({ x: event.clientX, y: event.clientY });
    const rect = commands.getLogicalRect(element);
    const logicalDividerPosition = axis === 'x'
      ? rect.left + rect.width * split.ratio / 100
      : rect.top + rect.height * split.ratio / 100;
    commands.setLayoutInteraction(true);
    dividerDrag = {
      splitId,
      axis,
      rect,
      element,
      ratio: split.ratio,
      logicalOffset: (axis === 'x' ? pointer.x : pointer.y) - logicalDividerPosition,
    };
    document.body.classList.add(axis === 'x' ? 'resize-x' : 'resize-y');
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
      preview.dispose();
      document.body.classList.remove('is-splitting', 'resize-x', 'resize-y');
      commands.setLayoutInteraction(false);
    },
  };
}
