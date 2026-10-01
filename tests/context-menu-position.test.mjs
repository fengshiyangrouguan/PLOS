import {
  resolveContextMenuPlacement,
  resolveSubmenuPlacement,
} from '../src/render/context-menu-position.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootAtTopLeft = resolveContextMenuPlacement(100, 120, 252, 140, 1200, 800);
assert(rootAtTopLeft.horizontal === 'right' && rootAtTopLeft.vertical === 'down', '左上主菜单应向右下展开');
assert(rootAtTopLeft.left === 100 && rootAtTopLeft.top === 120, '左上主菜单锚点错误');

const rootAtBottomRight = resolveContextMenuPlacement(1100, 700, 252, 140, 1200, 800);
assert(rootAtBottomRight.horizontal === 'left' && rootAtBottomRight.vertical === 'up', '右下主菜单应向左上展开');
assert(rootAtBottomRight.left === 848 && rootAtBottomRight.top === 560, '右下主菜单锚点错误');

const clampedRoot = resolveContextMenuPlacement(-40, 900, 252, 140, 1200, 800);
assert(clampedRoot.left === 12, '主菜单横向必须保留安全边距');
assert(clampedRoot.top === 648, '主菜单纵向必须保留安全边距');

const deepBottomBranch = resolveSubmenuPlacement(
  { left: 700, right: 952, top: 690, bottom: 734 },
  252,
  420,
  1200,
  800,
  'left',
  'down',
);
assert(deepBottomBranch.horizontal === 'left', '空间足够时应保留首选水平方向');
assert(deepBottomBranch.vertical === 'up', '深层分支靠近底部时必须独立向上翻转');

const rightEdgeBranch = resolveSubmenuPlacement(
  { left: 900, right: 1152, top: 100, bottom: 144 },
  252,
  240,
  1200,
  800,
  'right',
  'down',
);
assert(rightEdgeBranch.horizontal === 'left', '右侧空间不足时当前一级必须向左翻转');
assert(rightEdgeBranch.vertical === 'down', '下方空间足够时不应错误翻转');

const oversizedSubmenu = resolveSubmenuPlacement(
  { left: 450, right: 702, top: 350, bottom: 394 },
  252,
  1000,
  1200,
  800,
  'right',
  'down',
);
assert(oversizedSubmenu.availableHeight < 1000, '超高子菜单必须返回可滚动的高度上限');

console.log('菜单定位测试通过：根菜单夹紧、逐级翻转与超高菜单限制均正确。');
