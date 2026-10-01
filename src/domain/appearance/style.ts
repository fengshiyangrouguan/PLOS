import type { AreaAppearance, ShadowDirection } from './types';

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  const number = Number.parseInt(expanded, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${opacity})`;
}

export function applyAreaAppearance(element: HTMLElement, appearance: AreaAppearance): void {
  const values = appearanceValues(appearance);
  element.style.setProperty('--area-border', values.border);
  element.style.setProperty('--area-background', values.background);
  element.style.setProperty('--area-backdrop', values.backdrop);
  element.style.setProperty('--area-shadow', appearanceShadow(appearance));
  element.style.setProperty('--area-radius', values.radius);
}

/** 顶部 Chrome Editor 使用独立变量，避免它与任何 Area 的设置互相覆盖。 */
export function applyTopBarAppearance(element: HTMLElement, appearance: AreaAppearance): void {
  const values = appearanceValues(appearance);
  element.style.setProperty('--topbar-border', values.border);
  element.style.setProperty('--topbar-background', values.background);
  element.style.setProperty('--topbar-backdrop', values.backdrop);
  element.style.setProperty('--topbar-shadow', appearanceShadow(appearance));
  element.style.setProperty('--topbar-radius', values.radius);
}

const SHADOW_VECTORS: Record<ShadowDirection, readonly [x: number, y: number]> = {
  top: [0, -1],
  'top-right': [0.707, -0.707],
  right: [1, 0],
  'bottom-right': [0.707, 0.707],
  bottom: [0, 1],
  'bottom-left': [-0.707, 0.707],
  left: [-1, 0],
  'top-left': [-0.707, -0.707],
};

/**
 * 所有 Editor 只使用外阴影，不混入任何 inset 内阴影。
 * 强度只进入 rgba alpha；大小只决定覆盖范围；类型只决定边缘是否模糊。
 */
function appearanceShadow(appearance: AreaAppearance): string {
  if (appearance.shadowOpacity === 0 || appearance.shadowSize === 0) return 'none';
  const [vectorX, vectorY] = SHADOW_VECTORS[appearance.shadowDirection];
  const offsetDistance = appearance.shadowSize * 0.35;
  const offsetX = Number((vectorX * offsetDistance).toFixed(2));
  const offsetY = Number((vectorY * offsetDistance).toFixed(2));
  const blur = appearance.shadowType === 'hard' ? 0 : appearance.shadowSize;
  const spread = appearance.shadowType === 'hard' ? Math.max(1, appearance.shadowSize * 0.32) : 0;
  return `${offsetX}px ${offsetY}px ${blur}px ${spread}px rgba(22,45,49,${appearance.shadowOpacity})`;
}

function appearanceValues(appearance: AreaAppearance): {
  border: string;
  background: string;
  backdrop: string;
  radius: string;
} {
  const border = appearance.borderWidth === 0 || appearance.borderOpacity === 0
    ? '0px solid transparent'
    : `${appearance.borderWidth}px solid ${hexToRgba(appearance.borderColor, appearance.borderOpacity)}`;
  const saturation = appearance.backgroundEffect === 'frosted' ? 0.72 : 1.08;
  const backdrop = appearance.backgroundEffect === 'plain'
    ? 'none'
    : `blur(${appearance.backgroundBlur}px) saturate(${saturation})`;
  return {
    border,
    background: hexToRgba(appearance.backgroundColor, appearance.backgroundOpacity),
    backdrop,
    radius: `${appearance.radius}px`,
  };
}
