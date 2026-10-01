/** 生成仅用于当前客户端会话的稳定节点标识。 */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
