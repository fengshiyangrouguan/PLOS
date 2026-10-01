import type { AppearanceTarget, AreaAppearance } from '@/domain/appearance/types';
import type { LayoutNode } from '@/domain/layout/types';
import type { ScreenDepthSettings } from '@/domain/screen/types';

export interface LayerState {
  root: LayoutNode;
}

export interface MenuState {
  open: boolean;
  x: number;
  y: number;
  target: AppearanceTarget | null;
}

export interface AppState {
  activeLayerId: string;
  layers: Record<string, LayerState>;
  areaGap: number;
  showCornerHints: boolean;
  screenDepth: ScreenDepthSettings;
  topBarAppearance: AreaAppearance;
  settingsOpen: boolean;
  menu: MenuState;
  themeId: 'light' | 'dark';
}

export interface PersistedState {
  activeLayerId: string;
  layers: Record<string, LayerState>;
  areaGap: number;
  showCornerHints: boolean;
  screenDepth: ScreenDepthSettings;
  topBarAppearance: AreaAppearance;
  themeId: 'light' | 'dark';
}
