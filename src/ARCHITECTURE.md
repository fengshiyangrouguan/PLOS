# Agent Dashboard 前端架构

## 状态通知与组件边界

Store 只负责保存可持久化状态和通知订阅者，不再要求 Action 手工声明 `layout`、`gap`、
`appearance` 等变化范围。渲染模块通过 `subscribeSlice(selector, listener, equals)` 声明自己读取的
状态切片；只有 selector 的结果变化时，组件才会收到通知。

当前长期存活的组件边界如下：

- Workspace 根组件订阅活动 Layer 和布局拓扑签名。只有切换 Layer、分割或合并 Area 才重建布局。
- 每个 Area 订阅自己的叶节点。Editor 类型变化只重挂该 Area 的 Editor，外观变化只写该 Area 的 CSS 变量。
- 每个 Split 订阅自己的比例，只同步 `--split-ratio`。
- Top Bar 分别订阅活动 Layer 和自己的外观。
- 菜单、设置、屏幕纵深和主题分别订阅自己的状态切片。

这里没有 VDOM。组件首次挂载时创建真实 DOM，结构变化时只整体替换所属子树。这个规模下，明确的
组件边界比通用 diff 更简单；Editor 以后出现大量日志时，可以在该 Editor 内部单独增加列表 diff，
无需改变全局渲染模型。

## 命令式热路径

以下交互不会在逐帧阶段写 Store，也不能改造成组件重渲染：

1. 外观滑块和颜色控件在 `input` 阶段按动画帧合并，直接写目标 Surface 的 CSS 变量；`change`
   阶段才提交最终状态。
2. Area 间隙预览只写 Workspace 根节点的 `--area-gap`，所有 Split 通过 CSS 继承获得结果。
3. 分割线拖动直接写当前 Split 的 `--split-ratio`，松开指针后才提交比例。
4. 屏幕纵深保持独立 RAF 通道，鼠标坐标和投影矩阵不进入 Store。

命令式预览的目标节点由 `mountApp` 注入。菜单、设置和拖拽模块不通过 `document.querySelectorAll`
扫描整个页面，也不直接导入 Store 单例。

## Editor 插件

`registerEditor()` 接收完整的 Editor 定义：类型标识、显示名、类型化数据 Provider、渲染函数和可选
生命周期。注册表会把具体数据类型封装成统一运行时接口；Editor 数据订阅只使所属 Area 的内容节点
重渲染。

`render/editors/index.ts` 使用构建期 eager glob 自动发现同目录注册文件。新增 Editor 时只需要增加
一个文件并调用 `registerEditor()`，无需修改中央 `EditorKind` 联合、`EditorContext` 或导入清单。
未来接入 HTTP/WebSocket 时，可以把该 Editor 的静态 `read` Provider 替换为自己的数据适配器，
并通过可选 `subscribe` 返回清理函数。

当前五个 Editor 都是轻量模块，采用 eager 注册以保证首屏恢复和右键菜单同步拿到完整目录。出现包含
大型图表、终端引擎或其他重依赖的 Editor 后，应改成“轻量 manifest eager + 实现模块 lazy”：manifest
提供 `kind`、`label` 和 loader，Area 首次使用时动态 import，并负责 Loading、Error、取消加载和卸载。
不能单独把现有 glob 的 `eager` 改为 `false`，否则模块加载前不会执行注册，持久化恢复和菜单目录会缺项。

## 拖拽与布局

每个 Workspace 创建一个 `DragController` 实例。拖拽状态、预览节点、事件监听和销毁清理都属于该
实例；业务操作通过命令接口注入。控制器只在自己的 Workspace 根节点内读取 Area 几何。

邻接命中位于 `interact/area-adjacency.ts`，是无 DOM 纯函数。它只选择拖出方向上共享边界的最近邻，
不会越过相邻 Area 命中远端目标。`body` class 只用于光标和玻璃冻结样式；拖拽与纵深控制器之间通过
显式 `setLayoutInteraction()` 通信。

布局树的 `replaceNode`、`removeArea`、`updateArea` 和 `updateSplit` 均为不可变更新。分割 Area 时保留
原 Area ID，只为新 Area 分配 ID，以保证局部订阅、外部引用和运行时资源能够保持稳定。

## 控件事务

外观及设置滑块遵循“开始、预览、提交”三阶段：

1. Pointer Down 或键盘首次操作时记录一次历史快照。
2. Input 阶段只执行命令式预览，保持菜单 DOM、焦点和指针捕获稳定。
3. Change 阶段把最终值不可变地写入 Store，并安排本地持久化。

## 视觉与持久化

`styles.css` 是唯一主样式入口。`theme/fractal-background.ts` 使用独立 Canvas 绘制静态背景，只在
视口尺寸变化时重绘；`theme/screen-depth.ts` 管理独立的投影动画通道。

当前持久化格式为 v6。恢复数据时只提取当前模型声明的字段，并迁移旧版 Area 外观，避免废弃字段
重新进入运行时状态。
