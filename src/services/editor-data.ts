import type { EditorContext } from '@/domain/editor/context';
import { findArea } from '@/domain/layout/tree';
import { getState } from '@/store/state';

/**
 * Editor 只依赖上下文，不关心数据来自 mock、HTTP 还是 WebSocket。
 * 后端接入时替换本服务即可，不需要修改任何 Editor。
 */
export function createEditorContext(rerender: (areaId: string) => void): EditorContext {
  return {
    getOverviewData: () => ({ throughput: 1284, activeTasks: 24, successRate: 98.6, latency: 182, progress: 72 }),
    getTelemetry: () => [
      { label: 'CPU', value: '64%', percent: 64 },
      { label: 'GPU', value: '41%', percent: 41 },
      { label: '内存', value: '12.4 / 32 GB', percent: 39 },
      { label: '队列深度', value: '18', percent: 56, tone: 'attention' },
    ],
    getActivity: () => [
      { time: '14:32:08', actor: 'Planner', text: '已拆解任务 #2048', tone: 'ok' },
      { time: '14:31:55', actor: 'Runner', text: '完成步骤 07 · 资源检查', tone: 'ok' },
      { time: '14:31:21', actor: 'Memory', text: '写入上下文快照', tone: 'info' },
      { time: '14:30:48', actor: 'Guard', text: '触发速率限制保护', tone: 'warn' },
    ],
    getLogs: () => [
      { time: '14:32:08', level: 'INFO', text: 'planner.plan() completed in 42ms' },
      { time: '14:32:07', level: 'INFO', text: 'dispatching task: normalize_context' },
      { time: '14:31:59', level: 'WARN', text: 'retry budget at 2 / 5' },
      { time: '14:31:55', level: 'INFO', text: 'runner.step(07) returned 200' },
      { time: '14:31:53', level: 'DEBUG', text: 'memory.snapshot size=1.2kb' },
    ],
    sendCommand: (areaId, command) => console.info(`Area ${areaId} 执行命令：${command}`),
    rerender,
    getAppearance: (areaId) => {
      const state = getState();
      const area = findArea(state.layers[state.activeLayerId].root, areaId);
      if (!area) throw new Error(`找不到 Area 外观：${areaId}`);
      return area.appearance;
    },
  };
}
