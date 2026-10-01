import { registerEditor } from '@/domain/editor/registry';
import { h } from '@/utils/dom';
import { BarChart } from '../instruments/BarChart';
import { ProgressBar } from '../instruments/ProgressBar';
import { StatCard } from '../instruments/StatCard';

interface OverviewData {
  throughput: number;
  activeTasks: number;
  successRate: number;
  latency: number;
  progress: number;
}

registerEditor({
  kind: 'overview', label: '运行概览',
  data: {
    read: (): OverviewData => ({ throughput: 1284, activeTasks: 24, successRate: 98.6, latency: 182, progress: 72 }),
  },
  render: (_area, data) => {
    return h('div', { class: 'editor overview-editor' },
      h('div', { class: 'overview-lead' },
        h('div', {}, h('span', { class: 'editor-kicker' }, 'AGENT PULSE / LIVE'), h('strong', { class: 'primary-value' }, data.throughput.toLocaleString()), h('span', { class: 'primary-unit' }, 'ops/min')),
        BarChart([31, 45, 39, 62, 51, 77, 68, 93, 82, 100], '过去一小时吞吐量趋势'),
      ),
      h('div', { class: 'metric-grid' },
        StatCard({ label: '活跃任务', value: String(data.activeTasks), delta: '+6 今日' }),
        StatCard({ label: '成功率', value: `${data.successRate}%`, delta: '+1.2%', tone: 'success' }),
        StatCard({ label: '平均延迟', value: `${data.latency}ms`, delta: '-24ms', tone: 'latency' }),
      ),
      ProgressBar('资源编排进度', data.progress),
    );
  },
});
