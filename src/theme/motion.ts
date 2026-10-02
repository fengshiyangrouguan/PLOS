const ENTER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EXIT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 浮层自己的生命周期控制器，结构直接对应 RhineLabUI 的 SurfaceTransition。
 * 节点由控制器持有，打开、关闭和中途反向操作都在同一个实例里完成，
 * 因而不需要在全局事件里判断“旧 DOM 是否仍然有效”。
 */
export class SurfaceTransition {
  private animations: Animation[] = [];
  private revision = 0;
  private readonly panel: HTMLElement;
  private readonly enterDuration: number;
  private readonly exitDuration: number;
  private readonly translatePanel: boolean;

  constructor(
    private readonly root: HTMLElement,
    options: {
      panel?: HTMLElement;
      enterDuration?: number;
      exitDuration?: number;
      translatePanel?: boolean;
    } = {},
  ) {
    this.panel = options.panel ?? root;
    this.enterDuration = options.enterDuration ?? 260;
    this.exitDuration = options.exitDuration ?? 170;
    this.translatePanel = options.translatePanel ?? true;
  }

  show(): void {
    this.run(true);
  }

  hide(finished: () => void): void {
    this.run(false, finished);
  }

  dispose(): void {
    this.revision += 1;
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }

  private run(show: boolean, finished?: () => void): void {
    const revision = ++this.revision;
    const rootOpacity = show ? '0' : (getComputedStyle(this.root).opacity || '1');
    for (const animation of this.animations) animation.cancel();
    this.animations = [];

    const complete = (): void => {
      if (revision !== this.revision) return;
      for (const animation of this.animations) animation.cancel();
      this.animations = [];
      finished?.();
    };

    if (reducedMotion()) {
      complete();
      return;
    }

    const options: KeyframeAnimationOptions = {
      duration: show ? this.enterDuration : this.exitDuration,
      easing: show ? ENTER_EASE : EXIT_EASE,
      fill: 'both',
    };
    const fade = this.root.animate(
      [{ opacity: rootOpacity }, { opacity: show ? 1 : 0 }],
      options,
    );
    this.animations.push(fade);
    if (this.translatePanel) {
      const computedTransform = getComputedStyle(this.panel).transform;
      const panelTransform = show
        ? 'translateY(10px)'
        : (computedTransform === 'none' ? 'translateY(0)' : computedTransform);
      this.animations.push(this.panel.animate(
        [
          { transform: panelTransform },
          { transform: `translateY(${show ? 0 : 7}px)` },
        ],
        options,
      ));
    }
    void fade.finished.then(complete).catch(() => undefined);
  }
}

/**
 * 工作区结构变化只对新内容执行一次短促揭示，不截取整页位图。
 *
 * 这里刻意不用 transform/translate：area-content 位于 `.area { overflow: hidden auto }`
 * 滚动容器内部，位移动画会被浏览器暂时计入 scrollable overflow，导致 Layer 切换时
 * 每个 Area 的滚动条先出现再消失。opacity + clip-path 只改变绘制结果，不改变布局尺寸
 * 和滚动范围，因此不会干扰滚动条、投影测量或 Area 角点命中判断。
 */
export function revealContent(element: HTMLElement): void {
  if (reducedMotion()) return;
  element.animate(
    [
      { opacity: 0.3, clipPath: 'inset(8px 0 0 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)' },
    ],
    { duration: 300, easing: ENTER_EASE },
  );
}
