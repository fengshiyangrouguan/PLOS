import { createDefaultAreaAppearance, DEFAULT_APPEARANCE, TOPBAR_APPEARANCE } from '@/domain/appearance/defaults';
import type { AreaAppearance } from '@/domain/appearance/types';
import type { LayoutNode } from '@/domain/layout/types';
import { DEFAULT_SCREEN_DEPTH } from '@/domain/screen/types';
import { clone } from '@/utils/clone';
import type { AppState, PersistedState } from './types';

const STORAGE_KEY = 'agent-dashboard:state';
const STORAGE_VERSION = 6;
let saveTimer: number | null = null;

function serialize(state: AppState): PersistedState {
  return {
    activeLayerId: state.activeLayerId,
    // 显式选择持久化字段，避免旧状态对象上的废弃属性再次写回本地存储。
    layers: Object.fromEntries(Object.entries(state.layers).map(([id, layer]) => [id, { root: layer.root }])),
    areaGap: state.areaGap,
    showCornerHints: state.showCornerHints,
    screenDepth: state.screenDepth,
    topBarAppearance: state.topBarAppearance,
    themeId: state.themeId,
  };
}

export function schedulePersist(state: AppState): void {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => persistNow(state), 300);
}

export function persistNow(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: serialize(state) }));
  }
  catch (error) {
    console.warn('Agent Dashboard 本地持久化失败', error);
  }
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; data?: PersistedState };
    if (!parsed.data) return null;
    if (parsed.version === 1) {
      // v1 的 Area 外观来自已经删除的多层主题补丁。迁移时保留用户布局与 Editor，
      // 只换成新主题的规范化外观，避免旧高模糊参数继续遮住程序化背景。
      const migrated = migrateLegacyAppearance(parsed.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: migrated }));
      return migrated;
    }
    if (parsed.version === 2) {
      // v2 已经使用新 Area 外观，只需补充独立的顶部 Chrome Editor 外观。
      const migrated = migrateShadowAppearance({
        ...parsed.data,
        topBarAppearance: clone(TOPBAR_APPEARANCE),
        screenDepth: clone(DEFAULT_SCREEN_DEPTH),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: migrated }));
      return migrated;
    }
    if (parsed.version === 3) {
      // v4 新增屏幕纵深设置；旧布局和全部 Area 外观保持原样。
      const migrated = migrateShadowAppearance({ ...parsed.data, screenDepth: clone(DEFAULT_SCREEN_DEPTH) });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: migrated }));
      return migrated;
    }
    if (parsed.version === 4) {
      // v5 把阴影拆成类型、方向和强度。原强度原样保留，只补默认的模糊与向下方向。
      const migrated = migrateShadowAppearance(parsed.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: migrated }));
      return migrated;
    }
    if (parsed.version === 5) {
      // v6 将阴影大小从强度中分离；旧强度不变，仅补充默认的 32px 大小。
      const migrated = migrateShadowAppearance(parsed.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: migrated }));
      return migrated;
    }
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed.data;
  }
  catch (error) {
    console.warn('本地布局数据无效，已回退到默认预设', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** 缺失字段只使用默认值补齐，绝不覆盖用户已有的 Area 外观设置。 */
function normalizeAppearance(appearance: Partial<AreaAppearance>): AreaAppearance {
  return { ...DEFAULT_APPEARANCE, ...appearance };
}

function migrateShadowAppearance(state: PersistedState): PersistedState {
  const migrateNode = (node: LayoutNode): LayoutNode => {
    if (node.type === 'area') return { ...node, appearance: normalizeAppearance(node.appearance) };
    return { ...node, first: migrateNode(node.first), second: migrateNode(node.second) };
  };
  return {
    ...state,
    topBarAppearance: { ...TOPBAR_APPEARANCE, ...state.topBarAppearance },
    layers: Object.fromEntries(Object.entries(state.layers).map(([id, layer]) => [
      id,
      { ...layer, root: migrateNode(layer.root) },
    ])),
  };
}

function migrateLegacyAppearance(state: PersistedState): PersistedState {
  const migrateNode = (node: LayoutNode): LayoutNode => {
    if (node.type === 'area') return { ...node, appearance: createDefaultAreaAppearance() };
    return { ...node, first: migrateNode(node.first), second: migrateNode(node.second) };
  };
  return {
    ...state,
    topBarAppearance: clone(TOPBAR_APPEARANCE),
    screenDepth: clone(DEFAULT_SCREEN_DEPTH),
    layers: Object.fromEntries(Object.entries(state.layers).map(([id, layer]) => [
      id,
      { ...layer, root: migrateNode(layer.root) },
    ])),
  };
}

export function clearPersisted(): void {
  localStorage.removeItem(STORAGE_KEY);
}
