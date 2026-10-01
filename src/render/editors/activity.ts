import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { EventRow } from '../instruments/EventRow';
import { SectionHead } from '../instruments/SectionHead';

registerEditor({
  kind: 'activity', label: '活动流',
  render: (area, context) => h('div', { class: 'editor activity-editor' },
    SectionHead({ kicker: 'EVENT STREAM', badge: '24 EVENTS' }),
    h('div', { class: 'event-list' }, ...context.getActivity(area.id).map(EventRow)),
  ),
});
