import type { Corner, SplitAxis } from '@/domain/layout/types';

export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PreviewProjectionBridge {
  root: HTMLElement;
  registerSurface: (element: HTMLElement, rect: LayoutRect) => () => void;
  setSurfaceRect: (element: HTMLElement, rect: LayoutRect) => void;
}

export interface DragPreviewController {
  showSplit: (rect: DOMRect, axis: SplitAxis, corner: Corner, pointer: { x: number; y: number }) => void;
  showMerge: (targetId: string, rect: DOMRect) => void;
  hide: () => void;
  dispose: () => void;
}

// 保持原有的快速退出节奏；动画完成后由短定时器清理瞬态预览节点。
const PREVIEW_EXIT_DURATION = 220;

/**
 * 拖拽预览只持有 layout 坐标。视觉曲面由 PreviewProjectionBridge 统一处理，
 * 因此本模块既不读取 client 坐标，也不知道当前曲率、鼠标跟随或展开动画的进度。
 */
export function createDragPreviewController(bridge: PreviewProjectionBridge): DragPreviewController {
  let current: HTMLDivElement | null = null;
  let currentKey: string | null = null;
  const unregisterSurface = new Map<HTMLDivElement, () => void>();
  const leavingPreviews = new Map<HTMLDivElement, number>();

  const setRect = (element: HTMLDivElement, rect: LayoutRect): void => {
    // 分别写几何属性，不能使用 cssText；投影器会在同一个 style 上维护 matrix3d 变量。
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${Math.max(0, rect.width)}px`;
    element.style.height = `${Math.max(0, rect.height)}px`;
    bridge.setSurfaceRect(element, rect);
  };

  const destroy = (element: HTMLDivElement): void => {
    unregisterSurface.get(element)?.();
    unregisterSurface.delete(element);
    element.remove();
  };

  const retire = (element: HTMLDivElement): void => {
    if (leavingPreviews.has(element)) return;
    element.classList.add('is-leaving');
    const timer = window.setTimeout(() => {
      destroy(element);
      leavingPreviews.delete(element);
    }, PREVIEW_EXIT_DURATION);
    leavingPreviews.set(element, timer);
  };

  const createElement = (mode: 'split' | 'merge', rect: LayoutRect, axis?: SplitAxis): HTMLDivElement => {
    const element = document.createElement('div');
    element.className = 'split-preview';
    element.dataset.depthSurface = 'drag-preview';
    element.setAttribute('aria-hidden', 'true');

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
    element.append(stripes, mergeIndicator);

    // 先建立平面几何，再注册投影；首个投影帧不会读取尚未定位的 DOM。
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${Math.max(0, rect.width)}px`;
    element.style.height = `${Math.max(0, rect.height)}px`;
    bridge.root.append(element);
    unregisterSurface.set(element, bridge.registerSurface(element, rect));
    void element.offsetWidth;
    element.classList.add(mode === 'merge' ? 'merge-preview' : 'split-mode');
    if (axis) element.classList.add(`axis-${axis}`);
    return element;
  };

  const show = (
    mode: 'split' | 'merge',
    key: string,
    rect: LayoutRect,
    axis?: SplitAxis,
  ): void => {
    if (current && currentKey !== key) {
      retire(current);
      current = null;
      currentKey = null;
    }
    if (!current) {
      current = createElement(mode, rect, axis);
      currentKey = key;
      return;
    }
    setRect(current, rect);
  };

  const hide = (): void => {
    if (!current) return;
    retire(current);
    current = null;
    currentKey = null;
  };

  return {
    showSplit: (rect, axis, corner, pointer) => {
      const firstSide = axis === 'x' ? corner.includes('left') : corner.includes('top');
      const x = Math.max(rect.left, Math.min(pointer.x, rect.right));
      const y = Math.max(rect.top, Math.min(pointer.y, rect.bottom));
      const previewRect = axis === 'x'
        ? {
            left: firstSide ? rect.left : x,
            top: rect.top,
            width: firstSide ? x - rect.left : rect.right - x,
            height: rect.height,
          }
        : {
            left: rect.left,
            top: firstSide ? rect.top : y,
            width: rect.width,
            height: firstSide ? y - rect.top : rect.bottom - y,
          };
      show('split', `split:${axis}`, previewRect, axis);
    },
    showMerge: (targetId, rect) => show('merge', `merge:${targetId}`, rect),
    hide,
    dispose: () => {
      if (current) destroy(current);
      current = null;
      currentKey = null;
      for (const [element, timer] of leavingPreviews) {
        window.clearTimeout(timer);
        destroy(element);
      }
      leavingPreviews.clear();
    },
  };
}
