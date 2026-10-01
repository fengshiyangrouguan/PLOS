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
  getLogicalRect: (element: HTMLElement) => DOMRect;
  getInteractionBlend: () => number;
}

export interface DragController {
  startCornerDrag: (event: PointerEvent, areaId: string, corner: Corner, element: HTMLElement) => void;
  startDividerDrag: (event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement) => void;
  dispose: () => void;
}

// 角点需要越过明确死区才进入分割或合并，轻微点击和手抖不会创建新 Area。
const CORNER_DRAG_THRESHOLD = 24;
const PREVIEW_EXIT_DURATION = 220;

type PreviewMode = 'split' | 'merge';

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
  let previewKey: string | null = null;
  const leavingPreviews = new Map<HTMLDivElement, number>();

  const previewElement = (): HTMLDivElement => {
    if (preview) return preview;
    preview = document.createElement('div');
    preview.className = 'split-preview';
    preview.setAttribute('aria-hidden', 'true');

    const stripes = document.createElement('div');
    stripes.className = 'split-preview-stripes';

    const mergeIndicator = document.createElement('div');
    mergeIndicator.className = 'merge-indicator';
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const marker = document.createElement('i');
      marker.className = `merge-indicator-corner ${corner}`;
      mergeIndicator.append(marker);
    }
    const label = document.createElement('span');
    label.textContent = 'MERGE';
    mergeIndicator.append(label);
    preview.append(stripes, mergeIndicator);
    document.body.append(preview);
    return preview;
  };

  /**
   * 把当前预览冻结在最后一次几何位置，再独立执行退出动画。退出节点不再被复用，
   * 因而 merge 切换到 split 或另一个 merge 目标时，不会被移动到新矩形后才开始收回。
   */
  const retirePreview = (element: HTMLDivElement): void => {
    if (leavingPreviews.has(element)) return;
    element.classList.add('is-leaving');
    const timer = window.setTimeout(() => {
      element.remove();
      leavingPreviews.delete(element);
    }, PREVIEW_EXIT_DURATION);
    leavingPreviews.set(element, timer);
  };

  const hidePreview = (immediate = false): void => {
    if (immediate) {
      preview?.remove();
      preview = null;
      previewKey = null;
      for (const [element, timer] of leavingPreviews) {
        window.clearTimeout(timer);
        element.remove();
      }
      leavingPreviews.clear();
      return;
    }
    if (!preview) return;
    retirePreview(preview);
    preview = null;
    previewKey = null;
  };

  const showPreview = (
    mode: PreviewMode,
    key: string,
    cssText: string,
    axis?: SplitAxis,
  ): HTMLDivElement => {
    if (preview && previewKey !== key) {
      retirePreview(preview);
      preview = null;
      previewKey = null;
    }

    const needsEntrance = !preview;
    const element = previewElement();
    element.style.cssText = cssText;

    if (needsEntrance) {
      // 新状态建立独立入场帧；同一状态的普通 pointermove 只更新几何，不重启动画。
      void element.offsetWidth;
      element.classList.add(mode === 'merge' ? 'merge-preview' : 'split-mode');
      if (axis) element.classList.add(`axis-${axis}`);
      previewKey = key;
    }
    return element;
  };

  const showSplitPreview = (state: CornerDragState, event: { clientX: number; clientY: number }): void => {
    if (!state.axis) return;
    const { rect, axis, corner } = state;
    const firstSide = axis === 'x' ? corner.includes('left') : corner.includes('top');
    const x = Math.max(rect.left, Math.min(event.clientX, rect.right));
    const y = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
    if (axis === 'x') {
      showPreview(
        'split',
        `split:${axis}`,
        `left:${firstSide ? rect.left : x}px;top:${rect.top}px;width:${firstSide ? x - rect.left : rect.right - x}px;height:${rect.height}px`,
        axis,
      );
    }
    else {
      showPreview(
        'split',
        `split:${axis}`,
        `left:${rect.left}px;top:${firstSide ? rect.top : y}px;width:${rect.width}px;height:${firstSide ? y - rect.top : rect.bottom - y}px`,
        axis,
      );
    }
  };

  const showMergePreview = (targetId: string): void => {
    const target = workspaceRoot.querySelector<HTMLElement>(`[data-area="${targetId}"]`);
    if (!target) return;
    const rect = commands.getLogicalRect(target);
    showPreview(
      'merge',
      `merge:${targetId}`,
      `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`,
    );
  };

  const adjacentAreaAtPoint = (state: CornerDragState, x: number, y: number): string | null => {
    const candidates = Array.from(workspaceRoot.querySelectorAll<HTMLElement>('[data-area]'))
      .filter((element) => element.dataset.area !== state.areaId)
      .map((element) => ({ id: element.dataset.area!, rect: commands.getLogicalRect(element) }));
    return findAdjacentArea(
      state.rect,
      { x: state.startX - state.logicalOffsetX, y: state.startY - state.logicalOffsetY },
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
        hidePreview();
        return;
      }
      // 指针事件属于视觉曲面坐标；减去按下时记录的偏移后，才是稳定的平面布局坐标。
      const interactionBlend = commands.getInteractionBlend();
      const logicalX = event.clientX - cornerDrag.logicalOffsetX * interactionBlend;
      const logicalY = event.clientY - cornerDrag.logicalOffsetY * interactionBlend;
      const outward = outsideSource(cornerDrag, logicalX, logicalY);
      const targetId = outward ? adjacentAreaAtPoint(cornerDrag, logicalX, logicalY) : null;
      if (targetId) {
        cornerDrag.axis = null;
        cornerDrag.mergeTargetId = targetId;
        showMergePreview(targetId);
        return;
      }
      cornerDrag.mergeTargetId = null;
      if (outward) {
        cornerDrag.axis = null;
        hidePreview();
        return;
      }
      if (!cornerDrag.axis) cornerDrag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      const size = cornerDrag.axis === 'x' ? cornerDrag.rect.width : cornerDrag.rect.height;
      const position = cornerDrag.axis === 'x'
        ? logicalX - cornerDrag.rect.left
        : logicalY - cornerDrag.rect.top;
      const minRatio = Math.min(35, 140 / size * 100);
      cornerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
      showSplitPreview(cornerDrag, { clientX: logicalX, clientY: logicalY });
      return;
    }
    if (dividerDrag) {
      const size = dividerDrag.axis === 'x' ? dividerDrag.rect.width : dividerDrag.rect.height;
      const logicalOffset = dividerDrag.logicalOffset * commands.getInteractionBlend();
      const position = dividerDrag.axis === 'x'
        ? event.clientX - logicalOffset - dividerDrag.rect.left
        : event.clientY - logicalOffset - dividerDrag.rect.top;
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
      hidePreview();
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
    const rect = commands.getLogicalRect(element);
    const logicalCornerX = corner.includes('left') ? rect.left : rect.right;
    const logicalCornerY = corner.includes('top') ? rect.top : rect.bottom;
    commands.setLayoutInteraction(true);
    cornerDrag = {
      areaId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      logicalOffsetX: event.clientX - logicalCornerX,
      logicalOffsetY: event.clientY - logicalCornerY,
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
      logicalOffset: (axis === 'x' ? event.clientX : event.clientY) - logicalDividerPosition,
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
      hidePreview(true);
      document.body.classList.remove('is-splitting', 'resize-x', 'resize-y');
      commands.setLayoutInteraction(false);
    },
  };
}
