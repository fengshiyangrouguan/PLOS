import { h } from '@/utils/dom';

interface MeterProps { label: string; value: string; percent: number; tone?: 'attention'; }

export function Meter(props: MeterProps): HTMLElement {
  return h('div', { class: 'telemetry-row' },
    h('div', {}, h('span', {}, props.label), h('strong', {}, props.value)),
    h('div', { class: `meter ${props.tone ?? ''}` }, h('i', { style: { width: `${props.percent}%` } })),
  );
}
