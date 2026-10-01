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
  let previewMode: PreviewMode | null = null;
  let previewRemovalTimer = 0;

  const previewElement = (): HTMLDivElement => {
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = 'split-preview';
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
   * 预览退出不能立即删除 DOM，否则合并中心标识无法完成收回动画。
   * 同一个节点会在一次拖拽中复用；若退出期间重新命中目标，则取消定时删除并继续显示。
   */
  const hidePreview = (immediate = false): void => {
    if (!preview) return;
    if (immediate) {
      if (previewRemovalTimer) window.clearTimeout(previewRemovalTimer);
      previewRemovalTimer = 0;
      preview.remove();
      preview = null;
      previewMode = null;
      return;
    }
    if (preview.classList.contains('is-leaving')) return;
    if (previewRemovalTimer) window.clearTimeout(previewRemovalTimer);
    preview.classList.add('is-leaving');
    previewMode = null;
    const leavingElement = preview;
    previewRemovalTimer = window.setTimeout(() => {
      if (preview === leavingElement) {
        leavingElement.remove();
        preview = null;
      }
      previewRemovalTimer = 0;
    }, PREVIEW_EXIT_DURATION);
  };

  const showPreview = (mode: PreviewMode, cssText: string, axis?: SplitAxis): HTMLDivElement => {
    const needsEntrance = !preview || preview.classList.contains('is-leaving');
    const modeChanged = previewMode !== mode;
    const element = previewElement();
    if (previewRemovalTimer) {
      window.clearTimeout(previewRemovalTimer);
      previewRemovalTimer = 0;
    }
    element.style.cssText = cssText;

    if (needsEntrance || modeChanged) {
      element.classList.remove('is-leaving', 'split-mode', 'merge-preview', 'axis-x', 'axis-y');
      // 仅首次出现或撤销退出时建立起始帧；普通 pointermove 不触发布局读取。
      if (needsEntrance) void element.offsetWidth;
      element.classList.add(mode === 'merge' ? 'merge-preview' : 'split-mode');
      if (axis) element.classList.add(`axis-${axis}`);
      previewMode = mode;
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
        `left:${firstSide ? rect.left : x}px;top:${rect.top}px;width:${firstSide ? x - rect.left : rect.right - x}px;height:${rect.height}px`,
        axis,
      );
    }
    else {
      showPreview(
        'split',
        `left:${rect.left}px;top:${firstSide ? rect.top : y}px;width:${rect.width}px;height:${firstSide ? y - rect.top : rect.bottom - y}px`,
        axis,
      );
    }
  };

  const showMergePreview = (targetId: string): void => {
    const target = workspaceRoot.querySelector<HTMLElement>(`[data-area="${targetId}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showPreview('merge', `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`);
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
        hidePreview();
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
        hidePreview();
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
    // 先同步撤销曲面投影，再记录逻辑矩形，避免把投影后的外接框误当成布局坐标。
    commands.setLayoutInteraction(true);
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
  };

  const startDividerDrag = (event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement): void => {
    event.preventDefault();
    event.stopPropagation();
    const split = findSplit(commands.getLayout(), splitId);
    if (!split) return;
    // divider 与 Area 在同一时刻回到逻辑平面，拖动比例基于未投影的 split 尺寸计算。
    commands.setLayoutInteraction(true);
    dividerDrag = { splitId, axis, rect: element.getBoundingClientRect(), element, ratio: split.ratio };
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
