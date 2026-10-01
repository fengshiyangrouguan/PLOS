/**
 * 创建静态的菱形分形背景。
 *
 * 背景只在视口尺寸变化时重新绘制，不进入逐帧动画循环。这样既能保证图案真实存在，
 * 又不会与 Area 拖动、滑块输入争抢主线程。Canvas 是独立节点，不依赖 body 伪元素的
 * 层叠上下文，因此不会再次被页面底色意外遮住。
 */
export function mountFractalBackground(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return () => undefined;
  let frame = 0;

  const draw = (): void => {
    frame = 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const paper = context.createLinearGradient(0, 0, width, height);
    paper.addColorStop(0, '#e8f1f2');
    paper.addColorStop(0.38, '#f8fbfa');
    paper.addColorStop(0.66, '#f1f7f6');
    paper.addColorStop(1, '#dbe9ea');
    context.fillStyle = paper;
    context.fillRect(0, 0, width, height);

    // OIP 的远景由宽阔斜向平面构成。平面越靠近前景，颜色越深、边缘越明确。
    drawDepthPlanes(context, width, height);

    // 三个尺度的斜线网格形成可读的递归层级，大尺度线条承担主要构图。
    drawDiamondGrid(context, width, height, 224, 1.1, 'rgba(72, 111, 116, 0.072)');
    drawDiamondGrid(context, width, height, 88, 0.45, 'rgba(255, 255, 255, 0.32)');

    // 分形簇分布在视口边缘和中央，不依赖随机数，因此每次渲染结果一致。
    drawFractalDiamond(context, width * 0.13, height * 0.78, Math.min(width, height) * 0.16, 3);
    drawFractalDiamond(context, width * 0.86, height * 0.24, Math.min(width, height) * 0.13, 3);

    // 前景线路和方形节点提供 OIP 中最清晰的一层科技结构。
    drawCircuitLayer(context, width, height);

    // 极淡的扫描线为纯白区域提供材质，不使用昂贵的实时滤镜或噪波动画。
    context.strokeStyle = 'rgba(73, 103, 107, 0.025)';
    context.lineWidth = 1;
    for (let y = 31.5; y < height; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  };

  const requestDraw = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  draw();
  window.addEventListener('resize', requestDraw, { passive: true });
  return () => {
    window.removeEventListener('resize', requestDraw);
    if (frame) cancelAnimationFrame(frame);
  };
}

function drawDiamondGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  spacing: number,
  lineWidth: number,
  stroke: string,
): void {
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.beginPath();
  for (let offset = -height; offset < width + height; offset += spacing) {
    context.moveTo(offset, 0);
    context.lineTo(offset + height, height);
    context.moveTo(offset, height);
    context.lineTo(offset + height, 0);
  }
  context.stroke();
}

function drawDepthPlanes(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.translate(width * 0.5, height * 0.58);
  context.rotate(-Math.PI / 4);
  const span = Math.hypot(width, height) * 1.45;
  const planes = [
    { y: -height * 0.22, size: 68, color: 'rgba(255,255,255,0.28)' },
    { y: height * 0.20, size: 126, color: 'rgba(92,143,149,0.072)' },
    { y: height * 0.43, size: 54, color: 'rgba(62,123,131,0.085)' },
  ];
  for (const plane of planes) {
    context.fillStyle = plane.color;
    context.fillRect(-span / 2, plane.y, span, plane.size);
  }
  context.restore();
}

function drawCircuitLayer(context: CanvasRenderingContext2D, width: number, height: number): void {
  const scale = Math.min(width, height);
  const paths = [
    [[0.02, 0.86], [0.19, 0.70], [0.37, 0.84]],
    [[0.62, 0.92], [0.78, 0.77], [0.97, 0.88]],
  ] as const;

  paths.forEach((path, pathIndex) => {
    context.strokeStyle = pathIndex === 1 ? 'rgba(255,255,255,0.68)' : 'rgba(73,125,132,0.34)';
    context.lineWidth = pathIndex === 1 ? 1.35 : 0.75;
    context.beginPath();
    path.forEach(([x, y], index) => {
      const pointX = x * width;
      const pointY = y * height;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    context.stroke();

    path.forEach(([x, y], index) => {
      const nodeSize = Math.max(5, scale * (index === 1 ? 0.011 : 0.006));
      drawCircuitNode(context, x * width, y * height, nodeSize, pathIndex === 1 && index === 1);
    });
  });

  context.fillStyle = 'rgba(52,112,120,0.22)';
  for (let index = 0; index < 10; index += 1) {
    const size = index % 5 === 0 ? 5 : 2.5;
    const x = width * (0.22 + index * 0.025);
    const y = height * (0.75 - index * 0.021);
    context.fillRect(x, y, size, size);
  }
}

function drawCircuitNode(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  emphasized: boolean,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  context.fillStyle = 'rgba(248,252,251,0.94)';
  context.fillRect(-size / 2, -size / 2, size, size);
  context.strokeStyle = emphasized ? 'rgba(35,112,123,0.88)' : 'rgba(76,126,132,0.62)';
  context.lineWidth = emphasized ? 2 : 1;
  context.strokeRect(-size / 2, -size / 2, size, size);
  if (emphasized) {
    context.fillStyle = 'rgba(42,124,136,0.72)';
    context.fillRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
  }
  context.restore();
}

function drawFractalDiamond(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  depth: number,
): void {
  if (depth <= 0 || radius < 10) return;
  context.strokeStyle = `rgba(68, 108, 113, ${0.035 + depth * 0.018})`;
  context.lineWidth = depth >= 4 ? 1.8 : depth === 3 ? 1.15 : depth === 2 ? 0.75 : 0.45;
  context.beginPath();
  context.moveTo(centerX, centerY - radius);
  context.lineTo(centerX + radius, centerY);
  context.lineTo(centerX, centerY + radius);
  context.lineTo(centerX - radius, centerY);
  context.closePath();
  context.stroke();

  const childRadius = radius * 0.5;
  const childOffset = radius * 0.5;
  drawFractalDiamond(context, centerX - childOffset, centerY, childRadius, depth - 1);
  drawFractalDiamond(context, centerX + childOffset, centerY, childRadius, depth - 1);
  drawFractalDiamond(context, centerX, centerY - childOffset, childRadius, depth - 1);
  drawFractalDiamond(context, centerX, centerY + childOffset, childRadius, depth - 1);
}
