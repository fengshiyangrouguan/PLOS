import { h } from '@/utils/dom';

interface SectionHeadProps { kicker: string; badge?: string; badgeClass?: string; }

export function SectionHead(props: SectionHeadProps): HTMLElement {
  return h('div', { class: 'editor-inline-head' },
    h('span', { class: 'editor-kicker' }, props.kicker),
    props.badge ? h('span', { class: props.badgeClass ?? 'event-count' }, props.badge) : null,
  );
}
