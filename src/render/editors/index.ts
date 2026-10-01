import './overview';
import './telemetry';
import './activity';
import './terminal';
import './empty';

import type { AreaLeaf } from '@/domain/layout/types';
import type { EditorContext } from '@/domain/editor/context';
import { getEditor } from '@/domain/editor/registry';

const cleanups = new Map<string, () => void>();

export function renderEditor(area: AreaLeaf, context: EditorContext): HTMLElement {
  const definition = getEditor(area.editor);
  const element = definition.render(area, context);
  element.dataset.editorRoot = area.id;
  queueMicrotask(() => {
    const mountCleanup = definition.onMount?.(area, element, context);
    const unsubscribe = definition.subscribe?.(area, context);
    if (mountCleanup || unsubscribe || definition.onUnmount) {
      cleanups.set(area.id, () => {
        mountCleanup?.(); unsubscribe?.(); definition.onUnmount?.(area, element, context);
      });
    }
  });
  return element;
}

export function unmountEditors(): void {
  for (const cleanup of cleanups.values()) cleanup();
  cleanups.clear();
}

/** 只卸载一个 Area 的 Editor，用于局部数据刷新。 */
export function unmountEditor(areaId: string): void {
  cleanups.get(areaId)?.();
  cleanups.delete(areaId);
}
