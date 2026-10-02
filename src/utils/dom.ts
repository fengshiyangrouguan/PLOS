export type Child = Node | string | number | false | null | undefined;

export interface ElementProps {
  class?: string;
  text?: string;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  dataset?: Record<string, string>;
  title?: string;
  hidden?: boolean;
  disabled?: boolean;
  checked?: boolean;
  value?: string | number;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
  ariaPressed?: string;
  ariaOrientation?: string;
  onClick?: EventListener;
  onInput?: EventListener;
  onChange?: EventListener;
  onPointerDown?: EventListener;
  onContextMenu?: EventListener;
  [key: string]: unknown;
}

/**
 * DOM 工厂：直接创建真实节点并绑定事件，避免 HTML 字符串和二次 querySelector 绑定。
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key === 'text') element.textContent = String(value);
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    }
    else if (key.startsWith('aria')) {
      const name = `aria-${key.slice(4).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}`;
      element.setAttribute(name, String(value));
    }
    else if (key in element) (element as unknown as Record<string, unknown>)[key] = value;
    else element.setAttribute(key, String(value));
  }
  appendChildren(element, children);
  return element;
}

export function appendChildren(parent: Node, children: Child[]): void {
  for (const child of children.flat(Infinity) as Child[]) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function requiredElement<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`缺少必须的 DOM 节点：${selector}`);
  return element;
}
