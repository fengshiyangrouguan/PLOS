import type { LogLine } from '@/domain/editor/context';
import { h } from '@/utils/dom';

export function LogRow(line: LogLine): HTMLElement {
  return h('div', {},
    h('time', {}, line.time),
    h('span', { class: `level-${line.level.toLowerCase()}` }, line.level),
    h('code', {}, line.text),
  );
}
