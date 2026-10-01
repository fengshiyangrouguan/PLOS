import { createSliceObserver } from '../src/store/slice-subscription.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const events = [];
const observeCount = createSliceObserver(
  { count: 1, ignored: 'a' },
  (state) => state.count,
  (value, previous) => events.push([value, previous]),
);

observeCount({ count: 1, ignored: 'b' });
assert(events.length === 0, '无关字段变化不应通知 count 订阅者');
observeCount({ count: 2, ignored: 'b' });
assert(events.length === 1, '切片变化应通知一次');
assert(events[0][0] === 2 && events[0][1] === 1, '通知必须包含新旧切片');
observeCount({ count: 2, ignored: 'c' });
assert(events.length === 1, '相同切片不能重复通知');

const objectEvents = [];
const observePoint = createSliceObserver(
  { point: { x: 1, y: 2 } },
  (state) => state.point,
  (value) => objectEvents.push(value),
  (value, previous) => value.x === previous.x && value.y === previous.y,
);
observePoint({ point: { x: 1, y: 2 } });
observePoint({ point: { x: 2, y: 2 } });
assert(objectEvents.length === 1, '自定义比较器必须控制对象切片通知');

console.log('切片订阅测试通过：无关状态被忽略，变化切片只通知一次。');
