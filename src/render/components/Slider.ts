import { h } from '@/utils/dom';

interface SliderProps {
  appearanceKey?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onInput: (value: number, output: HTMLOutputElement) => void;
  onCommit?: (value: number) => void;
  onStart?: () => void;
}

export function Slider(props: SliderProps): HTMLLabelElement {
  let transactionStarted = false;
  const beginTransaction = (): void => {
    if (transactionStarted) return;
    transactionStarted = true;
    props.onStart?.();
  };
  const output = h('output', {
    dataset: {
      appearanceOutput: props.appearanceKey ?? '',
      suffix: props.suffix ?? '',
    },
  }, `${props.value}${props.suffix ?? ''}`);
  const input = h('input', {
    type: 'range', min: props.min, max: props.max, step: props.step, value: props.value,
    dataset: { appearanceKey: props.appearanceKey ?? '' },
    onPointerDown: beginTransaction as EventListener,
    onKeyDown: beginTransaction as EventListener,
    onInput: ((event: Event) => {
      beginTransaction();
      const value = Number((event.target as HTMLInputElement).value);
      output.value = `${value}${props.suffix ?? ''}`;
      props.onInput(value, output);
    }) as EventListener,
    onChange: ((event: Event) => {
      props.onCommit?.(Number((event.target as HTMLInputElement).value));
      transactionStarted = false;
    }) as EventListener,
  });
  return h('label', { class: 'menu-control' }, h('span', {}, props.label, output), input);
}
