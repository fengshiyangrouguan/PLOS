export type Selector<TState, TSlice> = (state: TState) => TSlice;
export type SliceListener<TSlice> = (value: TSlice, previous: TSlice) => void;
export type EqualityFn<TSlice> = (value: TSlice, previous: TSlice) => boolean;

/**
 * 把全量状态通知转换为切片通知。它不依赖浏览器或具体 Store，可被测试和其他状态容器复用。
 */
export function createSliceObserver<TState, TSlice>(
  initialState: TState,
  selector: Selector<TState, TSlice>,
  listener: SliceListener<TSlice>,
  equals: EqualityFn<TSlice> = Object.is,
): (state: TState) => void {
  let selected = selector(initialState);
  return (state) => {
    const next = selector(state);
    if (equals(next, selected)) return;
    const previous = selected;
    selected = next;
    listener(next, previous);
  };
}
