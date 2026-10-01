import { findAdjacentArea } from '../src/interact/area-adjacency.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = { left: 100, right: 300, top: 100, bottom: 300 };
const candidates = [
  { id: 'right-near', rect: { left: 308, right: 508, top: 100, bottom: 300 } },
  { id: 'right-far', rect: { left: 516, right: 716, top: 100, bottom: 300 } },
  { id: 'bottom', rect: { left: 100, right: 300, top: 308, bottom: 508 } },
  { id: 'diagonal', rect: { left: 308, right: 508, top: 308, bottom: 508 } },
];

const right = findAdjacentArea(source, { x: 300, y: 200 }, { x: 360, y: 200 }, candidates);
assert(right === 'right-near', '向右拖动必须命中共享边界的最近 Area');

const tooFar = findAdjacentArea(source, { x: 300, y: 200 }, { x: 650, y: 200 }, candidates);
assert(tooFar === null, '越过相邻 Area 后不能命中更远 Area');

const bottom = findAdjacentArea(source, { x: 200, y: 300 }, { x: 200, y: 360 }, candidates);
assert(bottom === 'bottom', '向下拖动必须命中垂直方向的相邻 Area');

const noSharedEdge = findAdjacentArea(
  source,
  { x: 300, y: 300 },
  { x: 360, y: 360 },
  [{ id: 'diagonal', rect: { left: 308, right: 508, top: 308, bottom: 508 } }],
);
assert(noSharedEdge === null, '只有角点接触、没有边重叠的 Area 不能合并');

console.log('Area 邻接测试通过：方向、共享边界和最近邻限制均正确。');
