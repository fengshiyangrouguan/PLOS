import { layoutApi } from '@/api/resources/layout';
import type { LayerState } from '@/store/types';

/**
 * 服务器同步边界集中在服务层。当前默认不主动调用，配置 VITE_API_URL 后可由应用策略启用。
 */
export async function syncLayer(layerId: string, layer: LayerState): Promise<void> {
  await layoutApi.save({ id: layerId, name: layerId, tree: layer.root, updatedAt: new Date().toISOString() });
}
