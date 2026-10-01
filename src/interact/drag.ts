import { createArea, createSplit } from '@/domain/layout/factory';
import { findArea, findSplit } from '@/domain/layout/tree';
import type { AreaLeaf, Corner, CornerDragState, DividerDragState, SplitAxis } from '@/domain/layout/types';
import { mergeArea, replaceLayoutNode, setSplitRatio } from '@/store/actions';
import { currentLayer } from '@/store/selectors';
import { getState } from '@/store/state';
import { clone } from '@/utils/clone';
import { uid } from '@/utils/id';

// 角点需要越过明确的死区才进入分割/合并，轻微点击或手抖不会创建新 Area。
const CORNER_DRAG_THRESHOLD = 24;
let cornerDrag: CornerDragState | null = null;
let dividerDrag: DividerDragState | null = null;
let moveFrame = 0;
let latestPointer: { clientX: number; clientY: number } | null = null;

function cloneArea(source: AreaLeaf): AreaLeaf {
  return { type: 'area', id: uid('area'), editor: source.editor, appearance: clone(source.appearance) };
}

function previewElement(): HTMLDivElement {
  let preview = document.querySelector<HTMLDivElement>('#split-preview');
  if (!preview) { preview = document.createElement('div'); preview.id = 'split-preview'; document.body.append(preview); }
  return preview;
}

function showSplitPreview(state: CornerDragState, event: { clientX: number; clientY: number }): void {
  if (!state.axis) return;
  const preview = previewElement();
  const { rect, axis, corner } = state;
  const firstSide = axis === 'x' ? corner.includes('left') : corner.includes('top');
  const x = Math.max(rect.left, Math.min(event.clientX, rect.right));
  const y = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
  if (axis === 'x') preview.style.cssText = `left:${firstSide ? rect.left : x}px;top:${rect.top}px;width:${firstSide ? x - rect.left : rect.right - x}px;height:${rect.height}px`;
  else preview.style.cssText = `left:${rect.left}px;top:${firstSide ? rect.top : y}px;width:${rect.width}px;height:${firstSide ? y - rect.top : rect.bottom - y}px`;
  preview.className = `split-preview axis-${axis}`;
}

function showMergePreview(targetId: string): void {
  const target = document.querySelector<HTMLElement>(`[data-area="${targetId}"]`);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const preview = previewElement();
  preview.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
  preview.className = 'split-preview merge-preview';
}

/** 只返回与当前 Area 共享拖出方向边界的最近邻，禁止越过中间 Area 合并远端目标。 */
function adjacentAreaAtPoint(state: CornerDragState, x: number, y: number): string | null {
  const source = state.rect;
  const sourceIsLeft = x < source.left;
  const sourceIsTop = y < source.top;
  const horizontalOutside = x < source.left || x > source.right;
  const verticalOutside = y < source.top || y > source.bottom;
  const horizontal = horizontalOutside && (!verticalOutside || Math.abs(x - state.startX) >= Math.abs(y - state.startY));
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-area]'))
    .filter((element) => element.dataset.area !== state.areaId)
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => {
      if (horizontal) {
        const overlap = Math.min(source.bottom, rect.bottom) - Math.max(source.top, rect.top);
        return overlap > 16 && (sourceIsLeft ? rect.right <= source.left + 4 : rect.left >= source.right - 4);
      }
      const overlap = Math.min(source.right, rect.right) - Math.max(source.left, rect.left);
      return overlap > 16 && (sourceIsTop ? rect.bottom <= source.top + 4 : rect.top >= source.bottom - 4);
    });
  candidates.sort(({ rect: a }, { rect: b }) => {
    const distance = (rect: DOMRect) => horizontal
      ? Math.abs((sourceIsLeft ? rect.right : rect.left) - (sourceIsLeft ? source.left : source.right))
      : Math.abs((sourceIsTop ? rect.bottom : rect.top) - (sourceIsTop ? source.top : source.bottom));
    return distance(a) - distance(b);
  });
  const nearest = candidates[0];
  if (!nearest) return null;
  const pointerNear = horizontal
    ? x >= nearest.rect.left - 18 && x <= nearest.rect.right + 18
    : y >= nearest.rect.top - 18 && y <= nearest.rect.bottom + 18;
  return pointerNear ? nearest.element.dataset.area ?? null : null;
}

function outsideSource(state: CornerDragState, x: number, y: number): boolean {
  const margin = 12;
  return x < state.rect.left - margin || x > state.rect.right + margin || y < state.rect.top - margin || y > state.rect.bottom + margin;
}

function commitCornerOperation(state: CornerDragState): void {
  if (state.mergeTargetId) { mergeArea(state.areaId, state.mergeTargetId); return; }
  if (!state.axis) return;
  const source = findArea(currentLayer(getState()).root, state.areaId);
  if (!source) return;
  const original = cloneArea(source);
  const created = cloneArea(source);
  const fromFirstSide = state.axis === 'x' ? state.corner.includes('left') : state.corner.includes('top');
  const replacement = createSplit(uid('split'), state.axis, state.ratio, fromFirstSide ? created : original, fromFirstSide ? original : created);
  replaceLayoutNode(source.id, replacement, created.id, '分割 Area');
}

function processPointerMove(event: { clientX: number; clientY: number }): void {
  if (cornerDrag) {
    const dx = event.clientX - cornerDrag.startX;
    const dy = event.clientY - cornerDrag.startY;
    if (Math.hypot(dx, dy) <= CORNER_DRAG_THRESHOLD) {
      cornerDrag.axis = null; cornerDrag.mergeTargetId = null;
      document.querySelector('#split-preview')?.remove();
      return;
    }
    const outward = outsideSource(cornerDrag, event.clientX, event.clientY);
    const targetId = outward ? adjacentAreaAtPoint(cornerDrag, event.clientX, event.clientY) : null;
    if (targetId) {
      cornerDrag.axis = null; cornerDrag.mergeTargetId = targetId;
      showMergePreview(targetId);
      return;
    }
    cornerDrag.mergeTargetId = null;
    if (outward) { cornerDrag.axis = null; document.querySelector('#split-preview')?.remove(); return; }
    if (!cornerDrag.axis) cornerDrag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const size = cornerDrag.axis === 'x' ? cornerDrag.rect.width : cornerDrag.rect.height;
    const position = cornerDrag.axis === 'x' ? event.clientX - cornerDrag.rect.left : event.clientY - cornerDrag.rect.top;
    const minRatio = Math.min(35, 140 / size * 100);
    cornerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
    showSplitPreview(cornerDrag, event);
    return;
  }
  if (dividerDrag) {
    const size = dividerDrag.axis === 'x' ? dividerDrag.rect.width : dividerDrag.rect.height;
    const position = dividerDrag.axis === 'x' ? event.clientX - dividerDrag.rect.left : event.clientY - dividerDrag.rect.top;
    const minRatio = Math.min(40, 140 / size * 100);
    dividerDrag.ratio = Math.max(minRatio, Math.min(100 - minRatio, position / size * 100));
    dividerDrag.element.style.setProperty('--split-ratio', `${dividerDrag.ratio}%`);
  }
}

/**
 * 指针设备可能在一帧内发送多次 move 事件。布局测量和预览绘制统一合并到下一帧，
 * 避免高刷新率鼠标让 getBoundingClientRect 与样式写入反复触发布局计算。
 */
function handlePointerMove(event: PointerEvent): void {
  if (!cornerDrag && !dividerDrag) return;
  latestPointer = { clientX: event.clientX, clientY: event.clientY };
  if (moveFrame) return;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0;
    if (latestPointer) processPointerMove(latestPointer);
    latestPointer = null;
  });
}

function handlePointerUp(): void {
  if (moveFrame) {
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
  }
  if (latestPointer) {
    processPointerMove(latestPointer);
    latestPointer = null;
  }
  if (cornerDrag) {
    document.querySelector('#split-preview')?.remove();
    const completed = cornerDrag;
    cornerDrag = null;
    document.body.classList.remove('is-splitting');
    if (completed.axis || completed.mergeTargetId) commitCornerOperation(completed);
  }
  if (dividerDrag) {
    const completed = dividerDrag;
    dividerDrag = null;
    document.body.classList.remove('resize-x', 'resize-y');
    setSplitRatio(completed.splitId, completed.ratio);
  }
}

export function startCornerDrag(event: PointerEvent, areaId: string, corner: Corner, element: HTMLElement): void {
  event.preventDefault(); event.stopPropagation();
  cornerDrag = { areaId, corner, startX: event.clientX, startY: event.clientY, rect: element.getBoundingClientRect(), axis: null, ratio: 50, mergeTargetId: null };
  document.body.classList.add('is-splitting');
}

export function startDividerDrag(event: PointerEvent, splitId: string, axis: SplitAxis, element: HTMLElement): void {
  event.preventDefault(); event.stopPropagation();
  const split = findSplit(currentLayer(getState()).root, splitId);
  if (!split) return;
  dividerDrag = { splitId, axis, rect: element.getBoundingClientRect(), element, ratio: split.ratio };
  document.body.classList.add(axis === 'x' ? 'resize-x' : 'resize-y');
}

export function initializeDragInteractions(): () => void {
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
  return () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    if (moveFrame) cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    latestPointer = null;
  };
}
