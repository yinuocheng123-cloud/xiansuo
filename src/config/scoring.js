/**
 * 文件说明：该文件定义线索匹配分的配置化评分规则。
 * 功能说明：集中维护加分项、扣分项与审核阈值，保证后续扩展只需改配置。
 *
 * 结构概览：
 *   第一部分：阈值配置
 *   第二部分：加分规则
 *   第三部分：扣分规则
 */

// ========== 第一部分：阈值配置 ==========
const SCORE_THRESHOLDS = {
  highPriority: 80,
  review: 60
};

// ========== 第二部分：加分规则 ==========
const POSITIVE_RULES = [
  { type: "keyword", key: "高定木作", score: 30, reason: "命中高定木作" },
  { type: "keyword", key: "木作展厅", score: 25, reason: "命中木作展厅" },
  { type: "keyword", key: "私宅木作", score: 20, reason: "命中私宅木作" },
  { type: "compound", key: "全案工作室+木作强相关", score: 20, reason: "全案工作室伴随强木作信号" },
  { type: "keyword", key: "木门墙柜一体", score: 20, reason: "命中木门墙柜一体" },
  { type: "keyword", key: "原木定制", score: 15, reason: "命中原木定制" },
  { type: "field", key: "contact", score: 15, reason: "存在联系方式" },
  { type: "field", key: "address", score: 10, reason: "存在地址" },
  { type: "field", key: "city", score: 10, reason: "存在城市" },
  { type: "field", key: "brand", score: 10, reason: "存在品牌" },
  { type: "space", key: "spaceSignal", score: 10, reason: "存在展厅/工作室/设计中心等空间属性词" }
];

// ========== 第三部分：扣分规则 ==========
const NEGATIVE_RULES = [
  { type: "exclude", key: "全屋定制", score: -20, reason: "命中全屋定制" },
  { type: "exclude", key: "橱柜衣柜", score: -15, reason: "命中橱柜衣柜" },
  { type: "exclude", key: "板式定制", score: -15, reason: "命中板式定制" },
  { type: "exclude", key: "装修公司", score: -15, reason: "命中装修公司" },
  { type: "exclude", key: "建材市场", score: -20, reason: "命中建材市场" },
  { type: "missing", key: "contact", score: -15, reason: "缺少联系方式" },
  { type: "missing", key: "address", score: -10, reason: "缺少地址" }
];

module.exports = {
  SCORE_THRESHOLDS,
  POSITIVE_RULES,
  NEGATIVE_RULES
};
