import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { Meter, type MeterProps as TelemetryDatum } from '../instruments/Meter';
import { SectionHead } from '../instruments/SectionHead';

registerEditor({
  kind: 'telemetry', label: '实时遥测',
  data: {
    read: (): TelemetryDatum[] => [
      { label: 'CPU', value: '64%', percent: 64 },
      { label: 'GPU', value: '41%', percent: 41 },
      { label: '内存', value: '12.4 / 32 GB', percent: 39 },
      { label: '队列深度', value: '18', percent: 56, tone: 'attention' },
    ],
  },
  render: (_area, data) => h('div', { class: 'editor telemetry-editor' },
    SectionHead({ kicker: 'SYSTEM PULSE / 15 MIN', badge: '5S SYNC', badgeClass: 'live-label' }),
    h('div', { class: 'telemetry-list' }, ...data.map(Meter)),
  ),
});
