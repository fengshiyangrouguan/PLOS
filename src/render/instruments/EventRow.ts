import { h } from '@/utils/dom';

export interface ActivityEvent {
  time: string;
  actor: string;
  text: string;
  tone: 'ok' | 'info' | 'warn';
}

export function EventRow(event: ActivityEvent): HTMLElement {
  return h('div', { class: 'event-row' },
    h('time', {}, event.time),
    h('i', { class: `event-dot ${event.tone}` }),
    h('div', {}, h('strong', {}, event.actor), h('span', {}, event.text)),
  );
}
