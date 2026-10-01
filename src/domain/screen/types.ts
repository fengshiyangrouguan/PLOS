export interface ScreenDepthSettings {
  enabled: boolean;
  depth: number;
  followStrength: number;
}

/**
 * 屏幕纵深默认关闭，避免首次进入时改变用户对平面界面的预期。
 * 数值统一使用 0-100，渲染控制器负责把它们映射为曲面光影、边缘纵深和反射视差。
 */
export const DEFAULT_SCREEN_DEPTH: ScreenDepthSettings = {
  enabled: false,
  depth: 36,
  followStrength: 28,
};
