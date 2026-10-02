export type MenuHorizontalDirection = 'left' | 'right';
export type MenuVerticalDirection = 'up' | 'down';

export interface RectangleLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ContextMenuPlacement {
  horizontal: MenuHorizontalDirection;
  vertical: MenuVerticalDirection;
  left: number;
  top: number;
}

export interface SubmenuPlacement {
  horizontal: MenuHorizontalDirection;
  vertical: MenuVerticalDirection;
  availableHeight: number;
  left: number;
  top: number;
}

const VIEWPORT_INSET = 12;
const SUBMENU_GUARD = 16;
const HORIZONTAL_OVERLAP = 1;
const VERTICAL_OVERLAP = 9;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function chooseDirection<T extends string>(
  preferred: T,
  alternative: T,
  preferredSpace: number,
  alternativeSpace: number,
  requiredSpace: number,
): T {
  if (requiredSpace <= preferredSpace) return preferred;
  if (requiredSpace <= alternativeSpace) return alternative;
  return preferredSpace >= alternativeSpace ? preferred : alternative;
}

/**
 * 主菜单使用真实宽高判断方向，而不是简单地按半屏划分。
 * 即使右键点靠近视口中心，也会优先选择能够完整容纳菜单的一侧，最后再把结果夹紧。
 */
export function resolveContextMenuPlacement(
  pointerX: number,
  pointerY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): ContextMenuPlacement {
  const safeWidth = Math.max(VIEWPORT_INSET * 2, viewportWidth);
  const safeHeight = Math.max(VIEWPORT_INSET * 2, viewportHeight);
  const x = clamp(pointerX, VIEWPORT_INSET, safeWidth - VIEWPORT_INSET);
  const y = clamp(pointerY, VIEWPORT_INSET, safeHeight - VIEWPORT_INSET);
  const rightSpace = safeWidth - VIEWPORT_INSET - x;
  const leftSpace = x - VIEWPORT_INSET;
  const downSpace = safeHeight - VIEWPORT_INSET - y;
  const upSpace = y - VIEWPORT_INSET;
  const preferredHorizontal: MenuHorizontalDirection = rightSpace >= leftSpace ? 'right' : 'left';
  const preferredVertical: MenuVerticalDirection = downSpace >= upSpace ? 'down' : 'up';
  const horizontal = chooseDirection(
    preferredHorizontal,
    preferredHorizontal === 'right' ? 'left' : 'right',
    preferredHorizontal === 'right' ? rightSpace : leftSpace,
    preferredHorizontal === 'right' ? leftSpace : rightSpace,
    menuWidth,
  );
  const vertical = chooseDirection(
    preferredVertical,
    preferredVertical === 'down' ? 'up' : 'down',
    preferredVertical === 'down' ? downSpace : upSpace,
    preferredVertical === 'down' ? upSpace : downSpace,
    menuHeight,
  );
  const maxLeft = Math.max(VIEWPORT_INSET, safeWidth - VIEWPORT_INSET - menuWidth);
  const maxTop = Math.max(VIEWPORT_INSET, safeHeight - VIEWPORT_INSET - menuHeight);

  return {
    horizontal,
    vertical,
    left: clamp(horizontal === 'right' ? x : x - menuWidth, VIEWPORT_INSET, maxLeft),
    top: clamp(vertical === 'down' ? y : y - menuHeight, VIEWPORT_INSET, maxTop),
  };
}

/**
 * 每一级子菜单都基于自己的触发项重新计算，不能继承根菜单后就不再检查。
 * SUBMENU_GUARD 为阴影、滚动条和测量误差预留空间，判定会比刚好贴边更保守。
 */
export function resolveSubmenuPlacement(
  trigger: RectangleLike,
  submenuWidth: number,
  submenuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  preferredHorizontal: MenuHorizontalDirection,
  preferredVertical: MenuVerticalDirection,
): SubmenuPlacement {
  const edge = VIEWPORT_INSET + SUBMENU_GUARD;
  const rightSpace = viewportWidth - edge - (trigger.right - HORIZONTAL_OVERLAP);
  const leftSpace = trigger.left + HORIZONTAL_OVERLAP - edge;
  const downSpace = viewportHeight - edge - (trigger.top - VERTICAL_OVERLAP);
  const upSpace = trigger.bottom + VERTICAL_OVERLAP - edge;
  const horizontal = chooseDirection(
    preferredHorizontal,
    preferredHorizontal === 'right' ? 'left' : 'right',
    preferredHorizontal === 'right' ? rightSpace : leftSpace,
    preferredHorizontal === 'right' ? leftSpace : rightSpace,
    submenuWidth,
  );
  const vertical = chooseDirection(
    preferredVertical,
    preferredVertical === 'down' ? 'up' : 'down',
    preferredVertical === 'down' ? downSpace : upSpace,
    preferredVertical === 'down' ? upSpace : downSpace,
    submenuHeight,
  );
  const availableHeight = Math.max(96, vertical === 'down' ? downSpace : upSpace);
  const renderedHeight = Math.min(submenuHeight, availableHeight);
  const unclampedLeft = horizontal === 'right'
    ? trigger.right - HORIZONTAL_OVERLAP
    : trigger.left + HORIZONTAL_OVERLAP - submenuWidth;
  const unclampedTop = vertical === 'down'
    ? trigger.top - VERTICAL_OVERLAP
    : trigger.bottom + VERTICAL_OVERLAP - renderedHeight;
  const maxLeft = Math.max(edge, viewportWidth - edge - submenuWidth);
  const maxTop = Math.max(edge, viewportHeight - edge - renderedHeight);

  return {
    horizontal,
    vertical,
    availableHeight,
    left: clamp(unclampedLeft, edge, maxLeft),
    top: clamp(unclampedTop, edge, maxTop),
  };
}
