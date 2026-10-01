import type { AreaLeaf } from '../layout/types';
import type { EditorContext } from './context';

export type EditorKind = 'overview' | 'telemetry' | 'activity' | 'terminal' | 'empty';
export type EditorCleanup = () => void;

export interface EditorDefinition {
  kind: EditorKind;
  label: string;
  render: (area: AreaLeaf, context: EditorContext) => HTMLElement;
  renderOptions?: (area: AreaLeaf, context: EditorContext) => HTMLElement | null;
  onMount?: (area: AreaLeaf, element: HTMLElement, context: EditorContext) => EditorCleanup | void;
  onUnmount?: (area: AreaLeaf, element: HTMLElement, context: EditorContext) => void;
  subscribe?: (area: AreaLeaf, context: EditorContext) => EditorCleanup;
}
