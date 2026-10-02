import type { AreaAppearance } from '../appearance/types';
import type { EditorKind } from '../editor/types';

export type SplitAxis = 'x' | 'y';
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface AreaLeaf {
  type: 'area';
  id: string;
  editor: EditorKind;
  appearance: AreaAppearance;
}

export interface SplitNode {
  type: 'split';
  id: string;
  axis: SplitAxis;
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
}

export type LayoutNode = AreaLeaf | SplitNode;

export interface CornerDragState {
  areaId: string;
  corner: Corner;
  startX: number;
  startY: number;
  rect: DOMRect;
  axis: SplitAxis | null;
  ratio: number;
  mergeTargetId: string | null;
}

export interface DividerDragState {
  splitId: string;
  axis: SplitAxis;
  rect: DOMRect;
  element: HTMLElement;
  ratio: number;
  /** 指针在 layout 坐标中相对分隔线中心的抓取偏移。 */
  logicalOffset: number;
}
