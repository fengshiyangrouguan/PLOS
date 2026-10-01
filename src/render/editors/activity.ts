import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { EventRow, type ActivityEvent } from '../instruments/EventRow';
import { SectionHead } from '../instruments/SectionHead';

registerEditor({
  kind: 'activity', label: '活动流',
  data: {
    read: (): ActivityEvent[] => [
      { time: '14:32:08', actor: 'Planner', text: '已拆解任务 #2048', tone: 'ok' },
      { time: '14:31:55', actor: 'Runner', text: '完成步骤 07 · 资源检查', tone: 'ok' },
      { time: '14:31:21', actor: 'Memory', text: '写入上下文快照', tone: 'info' },
      { time: '14:30:48', actor: 'Guard', text: '触发速率限制保护', tone: 'warn' },
    ],
  },
  render: (_area, data) => h('div', { class: 'editor activity-editor' },
    SectionHead({ kicker: 'EVENT STREAM', badge: '24 EVENTS' }),
    h('div', { class: 'event-list' }, ...data.map(EventRow)),
  ),
});
