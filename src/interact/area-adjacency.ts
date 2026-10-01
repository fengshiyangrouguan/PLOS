export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface AreaRect {
  id: string;
  rect: RectLike;
}

/**
 * 从候选矩形中寻找拖出方向上的第一块相邻 Area。
 * 该函数不读取 DOM，输入完全由拖拽控制器提供，因此边界规则可以独立测试。
 */
export function findAdjacentArea(
  source: RectLike,
  start: { x: number; y: number },
  pointer: { x: number; y: number },
  candidates: readonly AreaRect[],
): string | null {
  const sourceIsLeft = pointer.x < source.left;
  const sourceIsTop = pointer.y < source.top;
  const horizontalOutside = pointer.x < source.left || pointer.x > source.right;
  const verticalOutside = pointer.y < source.top || pointer.y > source.bottom;
  const horizontal = horizontalOutside
    && (!verticalOutside || Math.abs(pointer.x - start.x) >= Math.abs(pointer.y - start.y));

  const adjacent = candidates.filter(({ rect }) => {
    if (horizontal) {
      const overlap = Math.min(source.bottom, rect.bottom) - Math.max(source.top, rect.top);
      return overlap > 16 && (sourceIsLeft ? rect.right <= source.left + 4 : rect.left >= source.right - 4);
    }
    const overlap = Math.min(source.right, rect.right) - Math.max(source.left, rect.left);
    return overlap > 16 && (sourceIsTop ? rect.bottom <= source.top + 4 : rect.top >= source.bottom - 4);
  });

  adjacent.sort(({ rect: first }, { rect: second }) => {
    const distance = (rect: RectLike): number => horizontal
      ? Math.abs((sourceIsLeft ? rect.right : rect.left) - (sourceIsLeft ? source.left : source.right))
      : Math.abs((sourceIsTop ? rect.bottom : rect.top) - (sourceIsTop ? source.top : source.bottom));
    return distance(first) - distance(second);
  });

  const nearest = adjacent[0];
  if (!nearest) return null;
  const pointerNear = horizontal
    ? pointer.x >= nearest.rect.left - 18 && pointer.x <= nearest.rect.right + 18
    : pointer.y >= nearest.rect.top - 18 && pointer.y <= nearest.rect.bottom + 18;
  return pointerNear ? nearest.id : null;
}
