/**
 * 文件说明：该文件实现关键词匹配、线索类型判定与平台识别。
 * 功能说明：把业务边界集中到规则函数中，避免在抓取流程中分散判断逻辑。
 *
 * 结构概览：
 *   第一部分：基础匹配工具
 *   第二部分：线索类型推断
 *   第三部分：平台识别
 */

const { URL } = require("url");
const { KEYWORD_RULES, EXCLUSION_KEYWORDS, PROVINCE_KEYWORDS, CITY_KEYWORDS } = require("../config/keywords");
const { PLATFORM_RULES } = require("../config/platforms");

// ========== 第一部分：基础匹配工具 ==========
function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/[|｜\-—_·•【】\[\]()（）:：,，.。]/g, "")
    .trim()
    .toLowerCase();
}

function containsKeyword(text, keyword) {
  return String(text || "").includes(keyword);
}

function collectMatches(text, keywords) {
  return keywords.filter((keyword) => containsKeyword(text, keyword));
}

function collectSignals(text) {
  const joined = String(text || "");

  return {
    strongWood: collectMatches(joined, KEYWORD_RULES.strongWood),
    premium: collectMatches(joined, KEYWORD_RULES.premium),
    space: collectMatches(joined, KEYWORD_RULES.space),
    assistWood: collectMatches(joined, KEYWORD_RULES.assistWood),
    exclude: collectMatches(joined, EXCLUSION_KEYWORDS)
  };
}

function inferCity(text, preferredCity) {
  if (preferredCity && String(text || "").includes(preferredCity)) {
    return preferredCity;
  }

  return CITY_KEYWORDS.find((city) => String(text || "").includes(city)) || preferredCity || "";
}

function inferProvince(text, preferredProvince = "", preferredCity = "") {
  const source = String(text || "");

  if (preferredProvince && source.includes(preferredProvince)) {
    return preferredProvince;
  }

  if (preferredProvince) {
    return preferredProvince;
  }

  if (["北京", "上海", "天津", "重庆"].includes(preferredCity)) {
    return preferredCity;
  }

  return PROVINCE_KEYWORDS.find((province) => source.includes(province)) || "";
}

// ========== 第二部分：线索类型推断 ==========
function inferLeadType(signals) {
  const joinedStrong = signals.strongWood.join(" ");
  const joinedSpace = signals.space.join(" ");

  if (joinedStrong.includes("高定木作")) {
    return "高定木作";
  }

  if (
    joinedStrong.includes("木作展厅") ||
    joinedStrong.includes("木作美学馆") ||
    joinedSpace.includes("展厅") ||
    joinedSpace.includes("美学馆") ||
    joinedSpace.includes("体验馆")
  ) {
    return "木作展厅";
  }

  if (signals.space.includes("全案工作室") && signals.strongWood.length > 0) {
    return "全案工作室";
  }

  if (joinedStrong.includes("私宅木作") || (signals.premium.includes("私宅定制") && signals.strongWood.length > 0)) {
    return "私宅木作";
  }

  if (joinedStrong.includes("木门墙柜一体")) {
    return "木门墙柜一体";
  }

  if (joinedStrong.includes("原木定制")) {
    return "原木定制";
  }

  return "其他木作相关";
}

// ========== 第三部分：平台识别 ==========
function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname;
    const matched = PLATFORM_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(hostname)));

    if (matched) {
      return matched.name;
    }

    return "官网";
  } catch (error) {
    return "其他";
  }
}

module.exports = {
  normalizeText,
  containsKeyword,
  collectSignals,
  inferLeadType,
  inferCity,
  inferProvince,
  detectPlatform
};
