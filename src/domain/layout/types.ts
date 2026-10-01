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
  /** 曲面上的按下点相对未投影逻辑角点的偏移，用于把后续指针还原到布局坐标。 */
  logicalOffsetX: number;
  logicalOffsetY: number;
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
  /** 指针相对逻辑分隔线中心的轴向偏移，防止开始展平时比例瞬间跳变。 */
  logicalOffset: number;
}
