import { h } from '@/utils/dom';

export interface LogLine {
  time: string;
  level: 'INFO' | 'WARN' | 'DEBUG';
  text: string;
}

export function LogRow(line: LogLine): HTMLElement {
  return h('div', {},
    h('time', {}, line.time),
    h('span', { class: `level-${line.level.toLowerCase()}` }, line.level),
    h('code', {}, line.text),
  );
}
