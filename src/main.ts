// 完整的 Unicode 分片字体必须先于视觉样式加载，避免中英文混排时字重回退不一致。
import './theme/misans.css';
import './styles.css';
import { startApp } from './app';

// 入口只负责启动应用，业务状态、渲染和交互均由各自模块管理。
startApp();
