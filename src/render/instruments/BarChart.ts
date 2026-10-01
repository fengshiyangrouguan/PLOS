import { h } from '@/utils/dom';

export function BarChart(values: number[], label: string): HTMLElement {
  return h('div', { class: 'pulse-chart', ariaLabel: label },
    ...values.map((height) => h('i', { style: { height: `${height}%` } })),
  );
}
