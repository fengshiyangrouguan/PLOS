import type { AreaLeaf } from '../layout/types';

/** Editor 类型由注册表在运行时校验，新增插件不需要再修改中央联合类型。 */
export type EditorKind = string;
export type EditorCleanup = () => void;

export interface EditorDataProvider<TData> {
  read: (areaId: string) => TData;
  subscribe?: (areaId: string, listener: (data: TData) => void) => EditorCleanup;
}

/**
 * 一个 Editor 插件完整声明自己的数据类型、数据来源和视图。
 * TData 在注册调用处自动推导，注册表对外只暴露已经标准化的运行时定义。
 */
export interface EditorDefinition<TData = void> {
  kind: EditorKind;
  label: string;
  data?: EditorDataProvider<TData>;
  render: (area: AreaLeaf, data: TData) => HTMLElement;
  onMount?: (area: AreaLeaf, element: HTMLElement) => EditorCleanup | void;
  onUnmount?: (area: AreaLeaf, element: HTMLElement) => void;
}

/** 注册表内部使用的标准形态，已经封装具体 TData。 */
export interface RegisteredEditor {
  kind: EditorKind;
  label: string;
  render: (area: AreaLeaf) => HTMLElement;
  subscribe?: (area: AreaLeaf, invalidate: () => void) => EditorCleanup;
  onMount?: (area: AreaLeaf, element: HTMLElement) => EditorCleanup | void;
  onUnmount?: (area: AreaLeaf, element: HTMLElement) => void;
}
