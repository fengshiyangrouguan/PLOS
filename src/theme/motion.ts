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

  constructor(
    private readonly root: HTMLElement,
    private readonly panel: HTMLElement = root,
    private readonly enterDuration = 260,
    private readonly exitDuration = 170,
  ) {}

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
    const computedTransform = getComputedStyle(this.panel).transform;
    const panelTransform = show
      ? 'translateY(10px)'
      : (computedTransform === 'none' ? 'translateY(0)' : computedTransform);
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
    this.animations.push(this.panel.animate(
      [
        { transform: panelTransform },
        { transform: `translateY(${show ? 0 : 7}px)` },
      ],
      options,
    ));
    void fade.finished.then(complete).catch(() => undefined);
  }
}

/** 工作区结构变化只对新内容执行一次短促揭示，不截取整页位图。 */
export function revealContent(element: HTMLElement): void {
  if (reducedMotion()) return;
  element.animate(
    [
      { opacity: 0.3, translate: '0 8px' },
      { opacity: 1, translate: '0 0' },
    ],
    { duration: 300, easing: ENTER_EASE },
  );
}
