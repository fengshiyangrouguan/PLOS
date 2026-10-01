import type { AppState, LayerState } from './types';

export function currentLayer(state: AppState): LayerState {
  const layer = state.layers[state.activeLayerId];
  if (!layer) throw new Error(`活动 Layer 不存在：${state.activeLayerId}`);
  return layer;
}
