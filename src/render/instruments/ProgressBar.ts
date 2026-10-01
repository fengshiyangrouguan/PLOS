import { h } from '@/utils/dom';

export function ProgressBar(label: string, value: number): HTMLElement {
  return h('div', { class: 'mission-progress' },
    h('div', {}, h('span', {}, label), h('strong', {}, `${value}%`)),
    h('div', { class: 'progress-track' }, h('i', { style: { width: `${value}%` } })),
  );
}
