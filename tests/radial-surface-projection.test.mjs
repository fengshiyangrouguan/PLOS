import {
  projectSurfacePoint,
  surfaceQuadMatrix,
  unprojectSurfacePoint,
} from '../src/theme/radial-surface-projection.ts';

const EPSILON = 1e-8;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function almostEqual(actual, expected, epsilon = EPSILON) {
  return Math.abs(actual - expected) <= epsilon;
}

/**
 * 深度为零时投影必须退化为恒等映射，否则开关关闭后页面仍会残留缩放或位移。
 */
for (const [width, height] of [[800, 600], [1920, 1080], [900, 1200]]) {
  for (const point of [
    { x: 0, y: 0 },
    { x: width, y: height },
    { x: width * 0.37, y: height * 0.58 },
  ]) {
    const projected = projectSurfacePoint(point, width, height, 0, { x: 0.8, y: -0.6 });
    assert(almostEqual(projected.x, point.x), `恒等映射的 x 坐标错误：${JSON.stringify(projected)}`);
    assert(almostEqual(projected.y, point.y), `恒等映射的 y 坐标错误：${JSON.stringify(projected)}`);
  }
}

/**
 * 输入边界必须满足 layout → screen → layout 往返不变量。
 * 覆盖横屏、竖屏、不同曲率以及鼠标切向偏移，防止拖拽重新依赖经验 offset。
 */
for (const [width, height] of [[800, 600], [1920, 1080], [900, 1200]]) {
  for (const depth of [0, 0.18, 0.62, 1]) {
    for (const pointer of [{ x: 0, y: 0 }, { x: 0.7, y: -0.45 }, { x: -0.8, y: 0.6 }]) {
      for (const point of [
        { x: 0, y: 0 },
        { x: width, y: height },
        { x: width * 0.13, y: height * 0.81 },
        { x: width * 0.74, y: height * 0.26 },
      ]) {
        const projected = projectSurfacePoint(point, width, height, depth, pointer);
        const restored = unprojectSurfacePoint(projected, width, height, depth, pointer);
        assert(almostEqual(restored.x, point.x, 1e-4), `逆投影 x 往返错误：${JSON.stringify({ width, height, depth, pointer, point, restored })}`);
        assert(almostEqual(restored.y, point.y, 1e-4), `逆投影 y 往返错误：${JSON.stringify({ width, height, depth, pointer, point, restored })}`);
      }
    }
  }
}

/**
 * 指针位于中心时，径向曲面应保持左右对称；这可以防止纵深方向意外倾斜。
 */
for (const [width, height] of [[800, 600], [1920, 1080], [900, 1200]]) {
  const left = projectSurfacePoint(
    { x: width * 0.14, y: height * 0.37 },
    width,
    height,
    0.85,
    { x: 0, y: 0 },
  );
  const right = projectSurfacePoint(
    { x: width * 0.86, y: height * 0.37 },
    width,
    height,
    0.85,
    { x: 0, y: 0 },
  );
  assert(almostEqual(left.x + right.x, width), `左右对称性错误：${JSON.stringify({ left, right })}`);
  assert(almostEqual(left.y, right.y), `左右纵坐标不一致：${JSON.stringify({ left, right })}`);
}

/**
 * 齐次矩阵必须把元素的四个本地角点精确映射到目标四边形。
 * Area 和顶栏能否共同贴合曲面，取决于这一条不变量。
 */
const surfaceWidth = 640;
const surfaceHeight = 360;
const targetQuad = [
  { x: 8, y: 14 },
  { x: 630, y: 4 },
  { x: 616, y: 354 },
  { x: 20, y: 342 },
];
const matrix = surfaceQuadMatrix(surfaceWidth, surfaceHeight, targetQuad);
const sourceQuad = [
  { x: 0, y: 0 },
  { x: surfaceWidth, y: 0 },
  { x: surfaceWidth, y: surfaceHeight },
  { x: 0, y: surfaceHeight },
];

function mapPoint(point) {
  const denominator = matrix[3] * point.x + matrix[7] * point.y + matrix[15];
  return {
    x: (matrix[0] * point.x + matrix[4] * point.y + matrix[12]) / denominator,
    y: (matrix[1] * point.x + matrix[5] * point.y + matrix[13]) / denominator,
  };
}

sourceQuad.forEach((point, index) => {
  const mapped = mapPoint(point);
  const target = targetQuad[index];
  assert(almostEqual(mapped.x, target.x, 1e-6), `四边形角点 ${index} 的 x 映射错误`);
  assert(almostEqual(mapped.y, target.y, 1e-6), `四边形角点 ${index} 的 y 映射错误`);
});

console.log('投影测试通过：恒等映射、正反投影往返、径向对称与四角齐次矩阵均正确。');
