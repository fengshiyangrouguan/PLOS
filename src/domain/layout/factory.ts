import { createDefaultAreaAppearance } from '../appearance/defaults';
import type { EditorKind } from '../editor/types';
import type { AreaLeaf, LayoutNode, SplitAxis, SplitNode } from './types';

export function createArea(id: string, editor: EditorKind): AreaLeaf {
  return { type: 'area', id, editor, appearance: createDefaultAreaAppearance() };
}

export function createSplit(id: string, axis: SplitAxis, ratio: number, first: LayoutNode, second: LayoutNode): SplitNode {
  return { type: 'split', id, axis, ratio, first, second };
}
