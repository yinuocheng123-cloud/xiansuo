/**
 * 文件说明：该文件定义来源平台识别规则。
 * 功能说明：根据域名判断页面来自地图、公众号、抖音、小红书、官网或行业平台。
 *
 * 结构概览：
 *   第一部分：平台规则
 *   第二部分：任务来源范围默认值
 */

// ========== 第一部分：平台规则 ==========
const PLATFORM_RULES = [
  { name: "地图", patterns: [/amap\.com/i, /map\.baidu\.com/i, /ditu\.qq\.com/i] },
  { name: "公众号", patterns: [/mp\.weixin\.qq\.com/i, /weixin\.qq\.com/i] },
  { name: "抖音", patterns: [/douyin\.com/i, /iesdouyin\.com/i] },
  { name: "小红书", patterns: [/xiaohongshu\.com/i, /xhslink\.com/i, /rednote\.com/i] },
  { name: "行业平台", patterns: [/shejiben\.com/i, /to8to\.com/i, /jiaju/i, /jiancai/i] },
  { name: "搜索结果", patterns: [/bing\.com/i, /baidu\.com/i, /sogou\.com/i] }
];

// ========== 第二部分：任务来源范围默认值 ==========
const DEFAULT_SOURCE_SCOPE = ["搜索结果", "官网", "公众号"];

module.exports = {
  PLATFORM_RULES,
  DEFAULT_SOURCE_SCOPE
};
