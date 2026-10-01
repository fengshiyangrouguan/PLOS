import type { AreaLeaf, LayoutNode, SplitNode } from './types';

export function findArea(node: LayoutNode, id: string): AreaLeaf | null {
  if (node.type === 'area') return node.id === id ? node : null;
  return findArea(node.first, id) || findArea(node.second, id);
}

export function findSplit(node: LayoutNode, id: string): SplitNode | null {
  if (node.type === 'area') return null;
  if (node.id === id) return node;
  return findSplit(node.first, id) || findSplit(node.second, id);
}

export function findFirstAreaId(node: LayoutNode): string {
  return node.type === 'area' ? node.id : findFirstAreaId(node.first);
}

export function replaceNode(node: LayoutNode, id: string, replacement: LayoutNode): LayoutNode {
  if (node.id === id) return replacement;
  if (node.type === 'area') return node;
  const first = replaceNode(node.first, id, replacement);
  const second = replaceNode(node.second, id, replacement);
  return first === node.first && second === node.second ? node : { ...node, first, second };
}

/** 删除叶子后折叠只有单个子节点的 split，这是覆盖合并真正生效的关键。 */
export function removeArea(node: LayoutNode, id: string): LayoutNode | null {
  if (node.type === 'area') return node.id === id ? null : node;
  const first = removeArea(node.first, id);
  const second = removeArea(node.second, id);
  if (!first) return second;
  if (!second) return first;
  return first === node.first && second === node.second ? node : { ...node, first, second };
}

/**
 * 只复制从根节点到目标 Area 的路径，其余分支继续复用。
 * 这使渲染层能够通过引用变化准确判断“结构变化”和“单个 Area 变化”。
 */
export function updateArea(node: LayoutNode, id: string, update: (area: AreaLeaf) => AreaLeaf): LayoutNode {
  if (node.type === 'area') return node.id === id ? update(node) : node;
  const first = updateArea(node.first, id, update);
  const second = updateArea(node.second, id, update);
  return first === node.first && second === node.second ? node : { ...node, first, second };
}

/** 以不可变方式更新分割比例，拖动结束后无需重新创建整个布局树。 */
export function updateSplit(node: LayoutNode, id: string, ratio: number): LayoutNode {
  if (node.type === 'area') return node;
  if (node.id === id) return { ...node, ratio };
  const first = updateSplit(node.first, id, ratio);
  const second = updateSplit(node.second, id, ratio);
  return first === node.first && second === node.second ? node : { ...node, first, second };
}

export function visitAreas(node: LayoutNode, visitor: (area: AreaLeaf) => void): void {
  if (node.type === 'area') visitor(node);
  else { visitAreas(node.first, visitor); visitAreas(node.second, visitor); }
}
