import type { EditorKind } from '@/domain/editor/types';
import { h } from '@/utils/dom';

export type UiGlyphName = 'signal' | 'battery' | 'branch';

/**
 * 创建不依赖系统字体的几何图标。
 *
 * RhineLabUI 的小图标并不是任意放大字符，而是先固定图标盒，再以 1px/2px
 * 几何线条绘制。这里沿用同一原则：DOM 只提供稳定的绘制锚点，实际粗细由
 * 全局视觉 token 控制，因此 Windows 字体回退不会再改变图标尺寸和视觉重量。
 */
export function UiGlyph(name: UiGlyphName): HTMLElement {
  const children = name === 'signal'
    ? [h('i'), h('i'), h('i')]
    : name === 'battery'
      ? [h('i')]
      : [];

  return h('span', {
    class: `ui-glyph glyph-${name}`,
    ariaHidden: 'true',
  }, ...children);
}

/**
 * Editor 类型图标同样使用统一的 16px 图标盒。
 * 每种 Editor 只改变内部几何语义，不改变占位宽度，菜单文字因此始终对齐。
 */
export function EditorGlyph(kind: EditorKind): HTMLElement {
  return h('span', {
    class: `editor-type-glyph editor-type-${kind}`,
    ariaHidden: 'true',
  }, h('i'), h('i'), h('i'));
}
