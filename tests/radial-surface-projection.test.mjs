import {
  projectSurfacePoint,
  surfaceQuadMatrix,
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

console.log('投影测试通过：恒等映射、径向对称与四角齐次矩阵均正确。');
