/**
 * 对布局状态做结构化深拷贝。
 * 当前领域对象只包含可序列化数据，因此 structuredClone 是最准确的实现。
 */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
