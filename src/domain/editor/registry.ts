import type { EditorDefinition, EditorKind } from './types';

const registry = new Map<EditorKind, EditorDefinition>();

export function registerEditor(definition: EditorDefinition): void {
  if (registry.has(definition.kind)) throw new Error(`Editor 已注册：${definition.kind}`);
  registry.set(definition.kind, definition);
}

export function getEditor(kind: EditorKind): EditorDefinition {
  const definition = registry.get(kind) ?? registry.get('empty');
  if (!definition) throw new Error(`找不到 Editor：${kind}`);
  return definition;
}

export function getAllEditors(): EditorDefinition[] {
  return Array.from(registry.values());
}
