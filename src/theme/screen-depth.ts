import type { ScreenDepthSettings } from '@/domain/screen/types';
import { RadialSurfaceProjection } from './radial-surface-projection';

export interface ScreenDepthController {
  update: (settings: ScreenDepthSettings) => void;
  setSuspended: (suspended: boolean) => void;
  setLayoutInteraction: (active: boolean) => void;
  refreshSurfaces: () => void;
  dispose: () => void;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const RESPONSE_RATE = 7;
const SETTLE_EPSILON = 0.0001;

/**
 * RhineLabUI 风格的 DOM 曲面控制器。
 *
 * 控制器只负责输入、阻尼和生命周期；具体的径向投影与四角矩阵由
 * RadialSurfaceProjection 独立完成。这样布局变化不会混入逐帧热路径，曲面公式也可以
 * 被其他 Editor 或视觉表面复用。
 */
export function mountScreenDepth(
  stage: HTMLElement,
  initialSettings: ScreenDepthSettings,
): ScreenDepthController {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let settings = initialSettings;
  let suspended = false;
  let layoutInteraction = false;
  let frame = 0;
  let lastFrameTime = 0;
  let targetDepth = 0;
  let currentDepth = 0;
  const pointer = { x: 0, y: 0 };
  const targetPointer = { x: 0, y: 0 };
  let projection: RadialSurfaceProjection;

  const pointerStrength = (): number => clamp(settings.followStrength / 50, 0, 2);

  const updateProjection = (): void => {
    const effectiveDepth = layoutInteraction ? 0 : currentDepth;
    const effectivePointer = reducedMotion.matches ? { x: 0, y: 0 } : pointer;
    projection.update(effectiveDepth, effectivePointer);
  };

  const renderFrame = (time: number): void => {
    frame = 0;
    const deltaSeconds = lastFrameTime
      ? Math.min(0.1, Math.max(0, (time - lastFrameTime) / 1000))
      : 1 / 60;
    lastFrameTime = time;
    const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-deltaSeconds * RESPONSE_RATE);
    const nextPointerX = reducedMotion.matches ? 0 : targetPointer.x;
    const nextPointerY = reducedMotion.matches ? 0 : targetPointer.y;
    pointer.x += (nextPointerX - pointer.x) * blend;
    pointer.y += (nextPointerY - pointer.y) * blend;
    currentDepth += (targetDepth - currentDepth) * blend;
    updateProjection();

    const unsettled = Math.abs(nextPointerX - pointer.x) > SETTLE_EPSILON
      || Math.abs(nextPointerY - pointer.y) > SETTLE_EPSILON
      || Math.abs(targetDepth - currentDepth) > SETTLE_EPSILON;
    if (unsettled) {
      frame = requestAnimationFrame(renderFrame);
      return;
    }
    pointer.x = nextPointerX;
    pointer.y = nextPointerY;
    currentDepth = targetDepth;
    lastFrameTime = 0;
    updateProjection();
  };

  const requestFrame = (): void => {
    if (!frame) frame = requestAnimationFrame(renderFrame);
  };

  projection = new RadialSurfaceProjection(stage, requestFrame);

  const refreshSurfaces = (): void => {
    projection.setSurfaces(Array.from(
      stage.querySelectorAll<HTMLElement>('[data-depth-surface]'),
    ));
    updateProjection();
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (layoutInteraction || !settings.enabled || reducedMotion.matches) {
      targetPointer.x = 0;
      targetPointer.y = 0;
      requestFrame();
      return;
    }
    // 菜单或设置层打开后冻结当前曲面；浮层内移动鼠标不会改变其背后的空间状态。
    if (suspended) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;

    const rect = stage.getBoundingClientRect();
    const strength = pointerStrength();
    targetPointer.x = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1) * strength;
    targetPointer.y = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1) * strength;
    requestFrame();
  };

  const resetPointer = (): void => {
    targetPointer.x = 0;
    targetPointer.y = 0;
    requestFrame();
  };

  const applySettings = (next: ScreenDepthSettings): void => {
    settings = next;
    targetDepth = settings.enabled ? clamp(settings.depth, 0, 100) / 100 : 0;
    if (!settings.enabled || settings.followStrength <= 0) resetPointer();
    projection.invalidate();
    requestFrame();
  };

  const handleReducedMotionChange = (): void => requestFrame();
  const handleVisibilityChange = (): void => {
    if (document.hidden) resetPointer();
  };
  const handleFontChange = (): void => {
    projection.invalidate();
    requestFrame();
  };

  stage.addEventListener('pointermove', handlePointerMove, { passive: true });
  stage.addEventListener('pointerleave', resetPointer);
  window.addEventListener('blur', resetPointer);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.fonts.addEventListener('loadingdone', handleFontChange);
  reducedMotion.addEventListener('change', handleReducedMotionChange);
  void document.fonts.ready.then(handleFontChange);
  applySettings(initialSettings);

  return {
    update: applySettings,
    setSuspended: (nextSuspended) => {
      if (nextSuspended === suspended) return;
      suspended = nextSuspended;
      if (suspended) {
        // 同时冻结当前值与目标值，避免尚未完成的阻尼动画在菜单出现后继续滑动。
        targetPointer.x = pointer.x;
        targetPointer.y = pointer.y;
        requestFrame();
      }
    },
    setLayoutInteraction: (active) => {
      if (active === layoutInteraction) return;
      layoutInteraction = active;
      if (!active) projection.invalidate();
      requestFrame();
    },
    refreshSurfaces,
    dispose: () => {
      stage.removeEventListener('pointermove', handlePointerMove);
      stage.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.fonts.removeEventListener('loadingdone', handleFontChange);
      reducedMotion.removeEventListener('change', handleReducedMotionChange);
      if (frame) cancelAnimationFrame(frame);
      projection.dispose();
      stage.dataset.depthEnabled = 'false';
    },
  };
}
