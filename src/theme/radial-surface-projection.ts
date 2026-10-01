export interface SurfacePoint {
  x: number;
  y: number;
}

interface MeasuredSurface {
  element: HTMLElement;
  width: number;
  height: number;
  origin: SurfacePoint;
  corners: SurfacePoint[];
}

/**
 * 把舞台上的一个点投影到有界径向曲面。
 *
 * 数学模型沿用 RhineLabUI 的 HUD 曲面：
 * 1. 先把像素坐标转成保持宽高比的标准坐标；
 * 2. 使用 r² 径向项产生桶形曲率；
 * 3. 使用统一 fit 系数把屏幕四角约束回原边界；
 * 4. 指针只改变切向项，因此跟随不会退化成整块平移或平面旋转。
 */
export function projectSurfacePoint(
  point: SurfacePoint,
  width: number,
  height: number,
  depth: number,
  pointer: SurfacePoint,
): SurfacePoint {
  const aspect = width / height;
  const x = (point.x / width * 2 - 1) * aspect;
  const y = point.y / height * 2 - 1;
  const radius = x * x + y * y;
  const curvature = depth * 0.08;
  const fit = 1 / (1 + curvature * (aspect * aspect + 1));
  const centerX = pointer.x * 0.0075 * depth;
  const centerY = pointer.y * 0.0075 * depth;
  const tangentX = 2 * centerY * x * y + centerX * (radius + 2 * x * x);
  const tangentY = centerY * (radius + 2 * y * y) + 2 * centerX * x * y;

  return {
    x: width / 2 + (x * (1 + curvature * radius) - tangentX) * fit * height / 2,
    y: height / 2 + (y * (1 + curvature * radius) - tangentY) * fit * height / 2,
  };
}

/** 根据目标四边形求 DOM 可直接使用的齐次投影矩阵。 */
export function surfaceQuadMatrix(width: number, height: number, quad: SurfacePoint[]): number[] {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const dx1 = topRight.x - bottomRight.x;
  const dx2 = bottomLeft.x - bottomRight.x;
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy1 = topRight.y - bottomRight.y;
  const dy2 = bottomLeft.y - bottomRight.y;
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const perspectiveX = Math.abs(determinant) > 1e-9
    ? (dx3 * dy2 - dx2 * dy3) / determinant
    : 0;
  const perspectiveY = Math.abs(determinant) > 1e-9
    ? (dx1 * dy3 - dx3 * dy1) / determinant
    : 0;

  return [
    (topRight.x - topLeft.x + perspectiveX * topRight.x) / width,
    (topRight.y - topLeft.y + perspectiveX * topRight.y) / width,
    0,
    perspectiveX / width,
    (bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x) / height,
    (bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y) / height,
    0,
    perspectiveY / height,
    0, 0, 1, 0,
    topLeft.x, topLeft.y, 0, 1,
  ];
}

/**
 * 负责曲面节点的测量与矩阵写入。测量和动画严格分离：尺寸只在布局失效时读取，
 * 普通指针帧只执行纯数学计算并写 CSS 变量。
 */
export class RadialSurfaceProjection {
  private readonly stage: HTMLElement;
  private readonly onInvalidated: () => void;
  private surfaces: HTMLElement[] = [];
  private measured: MeasuredSurface[] = [];
  private dirty = true;
  private width = 1;
  private height = 1;
  private readonly observer: ResizeObserver;

  constructor(
    stage: HTMLElement,
    onInvalidated: () => void,
  ) {
    this.stage = stage;
    this.onInvalidated = onInvalidated;
    this.observer = new ResizeObserver(() => {
      this.dirty = true;
      this.onInvalidated();
    });
    this.observer.observe(stage);
  }

  setSurfaces(elements: HTMLElement[]): void {
    for (const element of this.surfaces) {
      element.classList.remove('screen-depth-surface');
      element.style.removeProperty('--screen-projection');
    }
    this.observer.disconnect();
    this.observer.observe(this.stage);
    this.surfaces = elements;
    for (const element of elements) {
      // 清除旧控制器遗留的内联 transform，投影只能由一个矩阵来源控制。
      element.style.removeProperty('transform');
      element.classList.add('screen-depth-surface');
      this.observer.observe(element);
    }
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  /**
   * 返回元素在曲面投影前的视口矩形。
   *
   * Area 和 divider surface 直接复用投影器的测量缓存，读取时不会关闭当前动画；
   * split 容器本身不参与投影，可以安全回退到原生 getBoundingClientRect()。拖拽层因此
   * 能在视觉仍处于曲面过渡时，始终使用稳定的平面布局坐标。
   */
  getLogicalRect(element: HTMLElement): DOMRect {
    if (this.dirty) this.measure();
    const surface = this.measured.find((item) => item.element === element);
    if (!surface) return element.getBoundingClientRect();

    const stageRect = this.stage.getBoundingClientRect();
    const scaleX = stageRect.width / Math.max(1, this.stage.offsetWidth) || 1;
    const scaleY = stageRect.height / Math.max(1, this.stage.offsetHeight) || 1;
    return new DOMRect(
      stageRect.left + surface.origin.x * scaleX,
      stageRect.top + surface.origin.y * scaleY,
      surface.width * scaleX,
      surface.height * scaleY,
    );
  }

  update(depth: number, pointer: SurfacePoint, keepEnabledAtRest = false): void {
    if (depth < 0.00001) {
      if (keepEnabledAtRest) {
        // 交互展平期间保留预分片材质，只撤销几何矩阵，避免顶部栏玻璃层在终点闪切。
        for (const element of this.surfaces) element.style.setProperty('--screen-projection', 'none');
        this.stage.dataset.depthEnabled = 'true';
      }
      else this.stage.dataset.depthEnabled = 'false';
      return;
    }
    if (this.dirty) this.measure();
    for (const surface of this.measured) {
      const projectedCorners = surface.corners.map((corner) => {
        const projected = projectSurfacePoint(corner, this.width, this.height, depth, pointer);
        return { x: projected.x - surface.origin.x, y: projected.y - surface.origin.y };
      });
      const matrix = surfaceQuadMatrix(surface.width, surface.height, projectedCorners);
      surface.element.style.setProperty(
        '--screen-projection',
        `matrix3d(${matrix.map((value) => Number(value.toFixed(9))).join(',')})`,
      );
    }
    this.stage.dataset.depthEnabled = 'true';
  }

  dispose(): void {
    this.observer.disconnect();
    for (const element of this.surfaces) {
      element.classList.remove('screen-depth-surface');
      element.style.removeProperty('--screen-projection');
    }
  }

  private measure(): void {
    const previousEnabled = this.stage.dataset.depthEnabled;
    this.stage.dataset.depthEnabled = 'false';
    const stageRect = this.stage.getBoundingClientRect();
    this.width = Math.max(1, this.stage.offsetWidth);
    this.height = Math.max(1, this.stage.offsetHeight);
    const scaleX = stageRect.width / this.width || 1;
    const scaleY = stageRect.height / this.height || 1;
    this.measured = [];

    for (const element of this.surfaces) {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (!width || !height || !element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      const origin = {
        x: (rect.left - stageRect.left) / scaleX,
        y: (rect.top - stageRect.top) / scaleY,
      };
      this.measured.push({
        element,
        width,
        height,
        origin,
        corners: [
          { x: origin.x, y: origin.y },
          { x: origin.x + width, y: origin.y },
          { x: origin.x + width, y: origin.y + height },
          { x: origin.x, y: origin.y + height },
        ],
      });
    }
    this.stage.dataset.depthEnabled = previousEnabled ?? 'false';
    this.dirty = false;
  }
}
