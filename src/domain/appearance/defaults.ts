import type { AreaAppearance } from './types';
import { clone } from '@/utils/clone';

export const DEFAULT_APPEARANCE: AreaAppearance = {
  borderWidth: 1,
  borderColor: '#9caeae',
  borderOpacity: 0.56,
  backgroundColor: '#f7faf9',
  backgroundOpacity: 0.58,
  backgroundBlur: 12,
  backgroundEffect: 'glass',
  shadowType: 'blurred',
  shadowDirection: 'bottom',
  shadowOpacity: 0.035,
  shadowSize: 32,
  radius: 0,
};

/** 顶部 Chrome Editor 的默认玻璃材质，与各 Layer 内的 Area 外观完全独立。 */
export const TOPBAR_APPEARANCE: AreaAppearance = {
  borderWidth: 1,
  borderColor: '#9fb1b1',
  borderOpacity: 0.38,
  backgroundColor: '#f4f9f8',
  backgroundOpacity: 0.42,
  backgroundBlur: 20,
  backgroundEffect: 'glass',
  shadowType: 'blurred',
  shadowDirection: 'bottom',
  shadowOpacity: 0.055,
  shadowSize: 32,
  radius: 0,
};

/**
 * 创建一个全新的 Area 外观。
 * 外观属于 Area，而不属于 Editor；Editor 切换时必须继续复用 Area 当前的外观对象。
 */
export function createDefaultAreaAppearance(): AreaAppearance {
  return clone(DEFAULT_APPEARANCE);
}
