import { createArea, createSplit } from '@/domain/layout/factory';
import type { LayoutNode } from '@/domain/layout/types';

export interface LayerPreset { id: string; label: string; shortLabel: string; root: LayoutNode; }

export const LAYER_PRESETS: LayerPreset[] = [
  { id: 'command', label: 'Command', shortLabel: '指挥', root: createArea('command-main', 'overview') },
  { id: 'observe', label: 'Observe', shortLabel: '观测', root: createSplit('observe-root', 'x', 61, createArea('observe-telemetry', 'telemetry'), createArea('observe-activity', 'activity')) },
  { id: 'debug', label: 'Debug', shortLabel: '诊断', root: createSplit('debug-root', 'y', 64, createArea('debug-terminal', 'terminal'), createArea('debug-telemetry', 'telemetry')) },
  { id: 'focus', label: 'Focus', shortLabel: '专注', root: createSplit('focus-root', 'x', 77, createArea('focus-main', 'overview'), createArea('focus-space', 'empty')) },
];
