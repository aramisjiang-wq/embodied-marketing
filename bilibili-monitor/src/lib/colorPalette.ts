/**
 * 统一调色板生成器 - 专为数据可视化设计
 * 
 * 设计原则：
 * 1. 使用黄金角度分割法（137.508°）确保颜色均匀分布
 * 2. 自己的品牌使用特殊高亮色（深蓝色系）
 * 3. 其他品牌使用高饱和度、高区分度的彩色系
 * 4. 支持最多100+品牌的颜色生成
 */

export interface ColorPalette {
  border: string;      // 边框/线条颜色
  fill: string;        // 填充颜色（带透明度）
  solid: string;       // 实心颜色（不透明）
  background: string;  // 背景色（浅色调）
}

/**
 * 生成HSL颜色
 */
function hsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * 为自己的品牌生成特殊配色（深蓝金配色）
 */
export function getSelfBrandColors(): ColorPalette {
  return {
    border: "#1E40AF",       // 深蓝色
    fill: "rgba(30, 64, 175, 0.7)",  // 淡蓝色70%透明
    solid: "#2563EB",        // 亮蓝色
    background: "#EFF6FF",   // 极淡蓝色背景
  };
}

/**
 * 使用黄金角度分割法生成调色板
 * @param count 需要的颜色数量
 * @param options 配置选项
 * @returns ColorPalette数组
 */
export function generateBrandPalette(
  count: number,
  options?: {
    saturation?: number;     // 饱和度 (0-100)，默认72
    lightness?: number;      // 亮度 (0-100)，默认55
    startHue?: number;       // 起始色相 (0-360)，默认0
    excludeSelf?: boolean;   // 是否排除第一个位置给"自己的品牌"
  }
): ColorPalette[] {
  const {
    saturation = 72,
    lightness = 55,
    startHue = 0,
    excludeSelf = false,
  } = options || {};

  const palette: ColorPalette[] = [];
  
  // 如果需要为"自己的品牌"预留第一个位置
  const actualCount = excludeSelf ? count : count;
  const _offset = excludeSelf ? 1 : 0; // reserved for future use
  void _offset;
  
  // 黄金角度 ≈ 137.508°
  const goldenAngle = 137.508;

  // 预留第一个位置给"自己的品牌"
  if (excludeSelf) {
    palette.push(getSelfBrandColors());
  }

  for (let i = 0; i < actualCount; i++) {
    // 使用黄金角度分割，确保颜色均匀分布且不重复
    const hue = (startHue + i * goldenAngle) % 360;

    // 主色调
    const mainColor = hsl(hue, saturation, lightness);
    
    // 填充色（60%透明度，用于面积图、气泡等）
    const fillColor = hsla(hue, saturation, lightness, 0.6);
    
    // 背景色（极淡版本，用于表格行、卡片背景）
    const bgColor = hsla(hue, Math.min(saturation, 40), 95, 0.3);

    palette.push({
      border: mainColor,
      fill: fillColor,
      solid: mainColor,
      background: bgColor,
    });
  }

  return palette;
}

/**
 * 获取预定义的品牌调色板（适合10-20个品牌）
 * 使用精选的高区分度颜色
 */
export function getPredefinedPalette(): ColorPalette[] {
  return [
    { border: "#3B82F6", fill: "rgba(59, 130, 246, 0.6)", solid: "#3B82F6", background: "rgba(59, 130, 246, 0.1)" },   // 蓝
    { border: "#EF4444", fill: "rgba(239, 68, 68, 0.6)", solid: "#EF4444", background: "rgba(239, 68, 68, 0.1)" },   // 红
    { border: "#10B981", fill: "rgba(16, 185, 129, 0.6)", solid: "#10B981", background: "rgba(16, 185, 129, 0.1)" },  // 绿
    { border: "#F59E0B", fill: "rgba(245, 158, 11, 0.6)", solid: "#F59E0B", background: "rgba(245, 158, 11, 0.1)" },  // 橙
    { border: "#8B5CF6", fill: "rgba(139, 92, 246, 0.6)", solid: "#8B5CF6", background: "rgba(139, 92, 246, 0.1)" },  // 紫
    { border: "#EC4899", fill: "rgba(236, 72, 153, 0.6)", solid: "#EC4899", background: "rgba(236, 72, 153, 0.1)" },  // 粉
    { border: "#06B6D4", fill: "rgba(6, 182, 212, 0.6)", solid: "#06B6D4", background: "rgba(6, 182, 212, 0.1)" },   // 青
    { border: "#84CC16", fill: "rgba(132, 204, 22, 0.6)", solid: "#84CC16", background: "rgba(132, 204, 22, 0.1)" },   // 青绿
    { border: "#F97316", fill: "rgba(249, 115, 22, 0.6)", solid: "#F97316", background: "rgba(249, 115, 22, 0.1)" },   // 深橙
    { border: "#6366F1", fill: "rgba(99, 102, 241, 0.6)", solid: "#6366F1", background: "rgba(99, 102, 241, 0.1)" },  // 靛蓝
    { border: "#14B8A6", fill: "rgba(20, 184, 166, 0.6)", solid: "#14B8A6", background: "rgba(20, 184, 166, 0.1)" },  // 蓝绿
    { border: "#E11D48", fill: "rgba(225, 29, 72, 0.6)", solid: "#E11D48", background: "rgba(225, 29, 72, 0.1)" },   // 玫红
    { border: "#A3E635", fill: "rgba(163, 230, 53, 0.6)", solid: "#A3E635", background: "rgba(163, 230, 53, 0.1)" },  // 黄绿
    { border: "#FB923C", fill: "rgba(251, 146, 60, 0.6)", solid: "#FB923C", background: "rgba(251, 146, 60, 0.1)" },  // 浅橙
    { border: "#38BDF8", fill: "rgba(56, 189, 248, 0.6)", solid: "#38BDF8", background: "rgba(56, 189, 248, 0.1)" },  // 天蓝
    { border: "#C084FC", fill: "rgba(192, 132, 252, 0.6)", solid: "#C084FC", background: "rgba(192, 132, 252, 0.1)" },  // 浅紫
    { border: "#4ADE80", fill: "rgba(74, 222, 128, 0.6)", solid: "#4ADE80", background: "rgba(74, 222, 128, 0.1)" },  // 翠绿
    { border: "#FB7185", fill: "rgba(251, 113, 133, 0.6)", solid: "#FB7185", background: "rgba(251, 113, 133, 0.1)" },  // 玫粉
    { border: "#2DD4BF", fill: "rgba(45, 212, 191, 0.6)", solid: "#2DD4BF", background: "rgba(45, 212, 191, 0.1)" },  // 蓝青
    { border: "#FBBF24", fill: "rgba(251, 191, 36, 0.6)", solid: "#FBBF24", background: "rgba(251, 191, 36, 0.1)" },  // 金黄
    { border: "#A78BFA", fill: "rgba(167, 139, 250, 0.6)", solid: "#A78BFA", background: "rgba(167, 139, 250, 0.1)" },  // 淡紫
  ];
}

/**
 * 根据品牌数量智能选择调色板
 * <= 20个：使用预定义调色板（更美观）
 * > 20个：使用算法生成的调色板（保证不重复）
 */
export function getSmartPalette(count: number): ColorPalette[] {
  if (count <= getPredefinedPalette().length) {
    return getPredefinedPalette().slice(0, count);
  } else {
    return generateBrandPalette(count);
  }
}
