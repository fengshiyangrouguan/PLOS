# Agent Dashboard 前端架构

## 渲染边界

应用只在启动时创建一次根结构。`render/app.ts` 长期持有 Top Bar、Workspace、菜单层和设置层，
Store 通过 `StateChange` 告诉渲染器本次变化属于哪个范围：

- `appearance`：只同步一个 Area 或顶部 Chrome Editor 的 CSS 变量和当前菜单控件。
- `gap`：只同步 Split 节点的间隙变量。
- `geometry`：拖动阶段已经更新 DOM，结束时只保存状态。
- `menu` / `settings`：只更新对应浮层。
- `layout` / `layer`：布局树确实变化时才重建 Workspace。
- `all`：首次恢复、撤销、重做或重置时执行完整同步。

因此，滑块、颜色选择器、时钟和菜单开关都不会卸载无关 Editor。

顶部控制栏作为独立的 Chrome Editor 使用同一套 `AreaAppearance` 数据模型。它不进入
Layer 的二叉分割树，但拥有独立的外观状态、右键菜单、实时预览和持久化数据，因此调整
顶栏透明度、模糊度或阴影不会修改任何 Area，也不会触发 Workspace 重建。

## 控件事务

外观滑块按“开始、预览、提交”三个阶段工作：

1. Pointer Down 或键盘首次操作时记录一次历史快照。
2. Input 阶段按动画帧合并，只把临时值应用到目标 Area。
3. Change 阶段把最终值不可变地写入 Store，并安排本地持久化。

这个流程同时保证拖动流畅、撤销粒度正确，并让菜单 DOM、焦点和指针捕获保持稳定。

## 视觉层

`styles.css` 是唯一主样式入口。旧的主题覆盖文件已经删除，避免来源顺序决定最终外观。
RhineLabUI 的源码仅作为界面语言依据：MiSans 字形、细线信息层级、无圆角控件、边缘导航，
以及只用于浮层的 18px 玻璃模糊。颜色统一替换成冷白和低饱和青灰。

`theme/fractal-background.ts` 使用独立 Canvas 绘制多尺度菱形网格和递归菱形簇。它没有动画循环，
只在视口尺寸变化时重新绘制，因此不会参与日常交互的重排和重绘。

## 状态与持久化

布局树的 `replaceNode`、`removeArea`、`updateArea` 和 `updateSplit` 均为不可变更新。
持久化格式 v2 保留旧版本的 Layer 切分树和 Editor 类型，但会迁移掉已经废弃的主题外观值，
防止旧的高不透明度和高模糊度继续遮住新背景。
