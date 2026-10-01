import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { LogRow } from '../instruments/LogRow';

registerEditor({
  kind: 'terminal', label: '日志 / 终端',
  render: (area, context) => h('div', { class: 'editor terminal-editor' },
    h('div', { class: 'terminal-status' }, h('span', {}, 'RUNTIME OUTPUT'), h('i', {}, h('span', { class: 'inline-status-dot', ariaHidden: 'true' }), 'LISTENING')),
    h('div', { class: 'terminal-lines' }, ...context.getLogs(area.id).map(LogRow)),
    h('div', { class: 'terminal-prompt' }, h('b', {}, '>'), h('span', {}, '输入命令…'), h('i')),
  ),
});
