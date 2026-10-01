import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { Meter } from '../instruments/Meter';
import { SectionHead } from '../instruments/SectionHead';

registerEditor({
  kind: 'telemetry', label: '实时遥测',
  render: (area, context) => h('div', { class: 'editor telemetry-editor' },
    SectionHead({ kicker: 'SYSTEM PULSE / 15 MIN', badge: '5S SYNC', badgeClass: 'live-label' }),
    h('div', { class: 'telemetry-list' }, ...context.getTelemetry(area.id).map(Meter)),
  ),
});
