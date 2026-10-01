import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { LogRow, type LogLine } from '../instruments/LogRow';

registerEditor({
  kind: 'terminal', label: '日志 / 终端',
  data: {
    read: (): LogLine[] => [
      { time: '14:32:08', level: 'INFO', text: 'planner.plan() completed in 42ms' },
      { time: '14:32:07', level: 'INFO', text: 'dispatching task: normalize_context' },
      { time: '14:31:59', level: 'WARN', text: 'retry budget at 2 / 5' },
      { time: '14:31:55', level: 'INFO', text: 'runner.step(07) returned 200' },
      { time: '14:31:53', level: 'DEBUG', text: 'memory.snapshot size=1.2kb' },
    ],
  },
  render: (_area, data) => h('div', { class: 'editor terminal-editor' },
    h('div', { class: 'terminal-status' }, h('span', {}, 'RUNTIME OUTPUT'), h('i', {}, h('span', { class: 'inline-status-dot', ariaHidden: 'true' }), 'LISTENING')),
    h('div', { class: 'terminal-lines' }, ...data.map(LogRow)),
    h('div', { class: 'terminal-prompt' }, h('b', {}, '>'), h('span', {}, '输入命令…'), h('i')),
  ),
});
