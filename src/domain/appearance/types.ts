export type BackgroundEffect = 'plain' | 'glass' | 'frosted';
export type ShadowType = 'hard' | 'blurred';
export type ShadowDirection = 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left';

/** 可打开外观编辑器的界面表面；Area 与顶部 Chrome 共用同一套外观模型。 */
export type AppearanceTarget =
  | { kind: 'area'; areaId: string }
  | { kind: 'topbar' };

export interface AreaAppearance {
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundEffect: BackgroundEffect;
  shadowType: ShadowType;
  shadowDirection: ShadowDirection;
  shadowOpacity: number;
  shadowSize: number;
  radius: number;
}
