import type { EditorDefinition, EditorKind, RegisteredEditor } from './types';

const registry = new Map<EditorKind, RegisteredEditor>();

export function registerEditor<TData = void>(definition: EditorDefinition<TData>): void {
  if (registry.has(definition.kind)) throw new Error(`Editor 已注册：${definition.kind}`);
  const registered: RegisteredEditor = {
    kind: definition.kind,
    label: definition.label,
    render: (area) => definition.render(
      area,
      definition.data ? definition.data.read(area.id) : undefined as TData,
    ),
    subscribe: definition.data?.subscribe
      ? (area, invalidate) => definition.data!.subscribe!(area.id, invalidate)
      : undefined,
    onMount: definition.onMount,
    onUnmount: definition.onUnmount,
  };
  registry.set(definition.kind, registered);
}

export function getEditor(kind: EditorKind): RegisteredEditor {
  const definition = registry.get(kind) ?? registry.get('empty');
  if (!definition) throw new Error(`找不到 Editor：${kind}`);
  return definition;
}

export function getAllEditors(): RegisteredEditor[] {
  return Array.from(registry.values());
}
