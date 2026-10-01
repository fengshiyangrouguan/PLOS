import type { AreaAppearance } from '../appearance/types';

export interface OverviewData { throughput: number; activeTasks: number; successRate: number; latency: number; progress: number; }
export interface TelemetryDatum { label: string; value: string; percent: number; tone?: 'attention'; }
export interface ActivityEvent { time: string; actor: string; text: string; tone: 'ok' | 'info' | 'warn'; }
export interface LogLine { time: string; level: 'INFO' | 'WARN' | 'DEBUG'; text: string; }

export interface EditorContext {
  getOverviewData: (areaId: string) => OverviewData;
  getTelemetry: (areaId: string) => TelemetryDatum[];
  getActivity: (areaId: string) => ActivityEvent[];
  getLogs: (areaId: string) => LogLine[];
  sendCommand: (areaId: string, command: string) => void;
  rerender: (areaId: string) => void;
  getAppearance: (areaId: string) => AreaAppearance;
}
