import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';

registerEditor({
  kind: 'empty', label: '空',
  // 空 Editor 只返回一个无内容节点；Area 本身仍保留统一外观与交互能力。
  render: () => h('div', { class: 'editor-empty' }),
});
