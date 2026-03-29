/**
 * 文件说明：该文件负责根据规则配置计算线索匹配分。
 * 功能说明：将关键词命中、字段完整度和排除词统一折算为 0 到 100 的分数。
 *
 * 结构概览：
 *   第一部分：基础计算
 *   第二部分：评分主函数
 */

const { POSITIVE_RULES, NEGATIVE_RULES, SCORE_THRESHOLDS } = require("../config/scoring");

// ========== 第一部分：基础计算 ==========
function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

// ========== 第二部分：评分主函数 ==========
function scoreLead({ signals, fields }) {
  let score = 0;
  const reasons = [];

  for (const rule of POSITIVE_RULES) {
    if (rule.type === "keyword" && signals.strongWood.includes(rule.key)) {
      score += rule.score;
      reasons.push(`+${rule.score} ${rule.reason}`);
    }

    if (rule.type === "compound" && signals.space.includes("全案工作室") && signals.strongWood.length > 0) {
      score += rule.score;
      reasons.push(`+${rule.score} ${rule.reason}`);
    }

    if (rule.type === "field" && fields[rule.key]) {
      score += rule.score;
      reasons.push(`+${rule.score} ${rule.reason}`);
    }

    if (rule.type === "space" && signals.space.length > 0) {
      score += rule.score;
      reasons.push(`+${rule.score} ${rule.reason}`);
    }
  }

  for (const rule of NEGATIVE_RULES) {
    if (rule.type === "exclude" && signals.exclude.includes(rule.key)) {
      score += rule.score;
      reasons.push(`${rule.score} ${rule.reason}`);
    }

    if (rule.type === "missing" && !fields[rule.key]) {
      score += rule.score;
      reasons.push(`${rule.score} ${rule.reason}`);
    }
  }

  return {
    score: clampScore(score),
    reasons,
    threshold: SCORE_THRESHOLDS
  };
}

module.exports = {
  scoreLead
};
