import { h } from '@/utils/dom';

interface StatCardProps { label: string; value: string; delta?: string; tone?: 'default' | 'success' | 'latency'; }

export function StatCard(props: StatCardProps): HTMLElement {
  return h('div', { class: `metric ${props.tone && props.tone !== 'default' ? props.tone : ''}` },
    h('span', {}, props.label),
    h('strong', {}, props.value),
    props.delta ? h('small', {}, props.delta) : null,
  );
}
