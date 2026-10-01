/*
 * 当前 Editor 都很轻量，因此启动时同步注册，菜单可以立即获得完整目录。
 * 不能只把 eager 改成 false：异步模块在加载前不会执行 registerEditor，菜单和持久化恢复都会缺项。
 * 出现重型 Editor 时应同时引入轻量 manifest、动态 loader 和 Area 内 Loading/Error 生命周期。
 */
import.meta.glob(['./*.ts', '!./index.ts'], { eager: true });

import type { AreaLeaf } from '@/domain/layout/types';
import { getEditor } from '@/domain/editor/registry';

/**
 * 把一个 Editor 挂到指定 Area 内容节点。数据订阅只会使这个节点重新渲染，
 * 不经过全局 Store，也不会触碰同一 Workspace 中的其他 Editor。
 */
export function mountEditor(host: HTMLElement, area: AreaLeaf): () => void {
  const definition = getEditor(area.editor);
  let element: HTMLElement | null = null;
  let mountCleanup: (() => void) | void;
  let disposed = false;

  const render = (): void => {
    if (disposed) return;
    if (element) {
      mountCleanup?.();
      definition.onUnmount?.(area, element);
    }
    element = definition.render(area);
    element.dataset.editorRoot = area.id;
    host.replaceChildren(element);
    mountCleanup = definition.onMount?.(area, element);
  };

  render();
  const unsubscribe = definition.subscribe?.(area, render);
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    if (element) {
      mountCleanup?.();
      definition.onUnmount?.(area, element);
    }
    host.replaceChildren();
  };
}
