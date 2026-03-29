/**
 * 文件说明：该文件实现页面字段提取逻辑。
 * 功能说明：从公开网页 HTML 中提取线索核心字段，并结合来源适配器提升品牌与地址识别精度。
 *
 * 结构概览：
 *   第一部分：基础清洗与候选挑选工具
 *   第二部分：品牌、地址、联系方式推断
 *   第三部分：线索生成主函数
 */

const { URL } = require("url");
const { extractTitle, extractH1, extractExcerpt, extractLinesAroundKeyword, extractMetaContent } = require("./html");
const { collectSignals, inferLeadType, inferCity, inferProvince, detectPlatform } = require("./rules");
const { scoreLead } = require("./scoring");
const { SCORE_THRESHOLDS } = require("../config/scoring");
const { buildPageAdapterContext } = require("./providers/pageAdapters");

// ========== 第一部分：基础清洗与候选挑选工具 ==========
const GENERIC_BRAND_WORDS = [
  "官网",
  "首页",
  "联系我们",
  "关于我们",
  "官方",
  "公众号",
  "地图",
  "搜索结果",
  "高定木作",
  "木作",
  "展厅",
  "工作室",
  "体验馆",
  "美学馆",
  "设计中心"
];

function cleanName(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[-|_]/g, " ")
    .replace(/^(首页|官网|公众号)\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeLineValue(line, labelPattern) {
  return String(line || "")
    .replace(labelPattern, "")
    .replace(/^\s*[:：]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFirstValid(candidates, validator = null) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) {
      continue;
    }

    if (!validator || validator(value)) {
      return value;
    }
  }

  return "";
}

function cleanBrandCandidate(value) {
  return cleanName(value)
    .replace(/^(品牌名称|品牌归属|所属品牌|品牌|公司名称|公众号|账号名称)[:：]?\s*/i, "")
    .replace(/(官网首页|官方网站|官方账号)$/i, "")
    .trim();
}

function isBrandLike(value, currentName = "") {
  const text = cleanBrandCandidate(value);
  if (!text || text.length < 2 || text.length > 24) {
    return false;
  }

  if (/[0-9]{5,}/.test(text) || /(电话|地址|联系|预约|导航)/.test(text)) {
    return false;
  }

  if (GENERIC_BRAND_WORDS.includes(text)) {
    return false;
  }

  if (currentName && text === cleanName(currentName)) {
    return false;
  }

  return true;
}

function cleanAddressCandidate(value) {
  return String(value || "")
    .replace(/^(展厅地址|门店地址|联系地址|公司地址|详细地址|项目地址|导航地址|地址|位置)[:：]?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[；;，,。].*?(电话|热线|预约|导航).*/i, "")
    .trim();
}

function isAddressLike(value) {
  const text = cleanAddressCandidate(value);
  if (!text || text.length < 6) {
    return false;
  }

  return /(省|市|区|县|镇|街|路|道|号|广场|大厦|园|中心|层|室)/.test(text);
}

function pickBestAddress(candidates) {
  return candidates
    .map((candidate) => cleanAddressCandidate(candidate))
    .filter(isAddressLike)
    .sort((left, right) => right.length - left.length)[0] || "";
}

function extractHostnameBrand(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    if (/bing\.com|baidu\.com|weixin\.qq\.com|douyin\.com|xiaohongshu\.com|amap\.com|map\.baidu\.com/i.test(hostname)) {
      return "";
    }

    return hostname.split(".")[0].replace(/[-_]/g, " ").trim();
  } catch (error) {
    return "";
  }
}

// ========== 第二部分：品牌、地址、联系方式推断 ==========
function extractContact(html, text, adapterContext) {
  const source = `${html || ""}\n${text || ""}`;
  const adapterContact = pickFirstValid(adapterContext.contactCandidates || []);
  if (adapterContact) {
    return adapterContact;
  }

  const phoneMatch = source.match(/(?<!\d)(?:0\d{2,3}[- ]?\d{7,8}|1[3-9]\d{9})(?!\d)/);
  if (phoneMatch) {
    return phoneMatch[0];
  }

  const hrefMatch = String(html || "").match(/href=["']([^"']*(?:contact|lianxi|about|joinus|reservation|yuyue)[^"']*)["']/i);
  return hrefMatch ? hrefMatch[1] : "";
}

function inferBrand(name, url, text, html, adapterContext) {
  const cleanedName = cleanName(name);
  const prefixMatch = cleanedName.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,16})(?:高定木作|木作展厅|木作美学馆|私宅木作|原木定制|全案工作室|工作室|展厅|美学馆|设计中心)/);
  if (prefixMatch && isBrandLike(prefixMatch[1], cleanedName)) {
    return prefixMatch[1];
  }

  const adapterBrand = pickFirstValid(
    (adapterContext.brandCandidates || []).map((line) => cleanBrandCandidate(normalizeLineValue(line, /^(品牌名称|品牌归属|所属品牌|品牌|公众号|账号名称|公司名称|商户|门店)[:：]?\s*/))),
    (value) => isBrandLike(value, cleanedName)
  );
  if (adapterBrand) {
    return adapterBrand;
  }

  const siteName = cleanBrandCandidate(extractMetaContent(html, "og:site_name") || extractMetaContent(html, "application-name"));
  if (isBrandLike(siteName, cleanedName)) {
    return siteName;
  }

  const hostnameBrand = cleanBrandCandidate(extractHostnameBrand(url));
  if (isBrandLike(hostnameBrand, cleanedName)) {
    return hostnameBrand;
  }

  const brandLine = cleanBrandCandidate(normalizeLineValue(extractLinesAroundKeyword(text, "品牌"), /^.*品牌[:：]?\s*/));
  if (isBrandLike(brandLine, cleanedName)) {
    return brandLine;
  }

  return "";
}

function inferAddress(text, adapterContext) {
  const source = String(text || "");
  const adapterAddress = pickBestAddress(adapterContext.addressCandidates || []);
  if (adapterAddress) {
    return adapterAddress;
  }

  const addressPatterns = [
    /(?:展厅地址|门店地址|联系地址|公司地址|地址|体验馆地址|项目地址)[:：]?\s*([^\n。；;]{6,120})/i,
    /((?:[\u4e00-\u9fa5]{2,8}(?:省|市))?[\u4e00-\u9fa5]{2,12}(?:区|县|镇|街道)[\u4e00-\u9fa5A-Za-z0-9\-路街道号弄室层座栋单元广场大厦园中心]{4,100})/,
    /((?:[\u4e00-\u9fa5]{2,8}(?:市|区))[\u4e00-\u9fa5A-Za-z0-9\-路街道号弄室层座栋单元广场大厦园中心]{6,100})/
  ];

  for (const pattern of addressPatterns) {
    const match = pattern.exec(source);
    if (match && isAddressLike(match[1])) {
      return cleanAddressCandidate(match[1]);
    }
  }

  return "";
}

// ========== 第三部分：线索生成主函数 ==========
function buildLeadFromHtml({ task, url, html }) {
  const title = extractTitle(html);
  const h1 = extractH1(html);
  // 地址、品牌等字段常出现在正文稍后位置，这里适当增加摘要长度，换取更稳的规则提取。
  const excerpt = extractExcerpt(html, 1600);
  const description = extractMetaContent(html, "description");
  const sourcePlatform = detectPlatform(url);
  const adapterContext = buildPageAdapterContext({
    sourcePlatform,
    title,
    h1,
    text: `${description} ${excerpt}`.trim(),
    html
  });
  const joinedText = [
    title,
    h1,
    description,
    excerpt,
    ...(adapterContext.nameCandidates || []),
    ...(adapterContext.brandCandidates || []),
    ...(adapterContext.addressCandidates || [])
  ]
    .filter(Boolean)
    .join(" ");

  const name = cleanName(pickFirstValid(adapterContext.nameCandidates || []) || h1 || title || url);
  const address = inferAddress(joinedText, adapterContext);
  const city = inferCity(`${joinedText} ${address}`, task.city);
  const province = inferProvince(`${joinedText} ${address}`, task.province, city);
  const contact = extractContact(html, joinedText, adapterContext);
  const brand = inferBrand(name, url, joinedText, html, adapterContext);
  const signals = collectSignals(joinedText);
  const leadType = inferLeadType(signals);
  const scoring = scoreLead({
    signals,
    fields: {
      contact,
      address,
      city,
      brand
    }
  });

  const reviewStatus = scoring.score >= SCORE_THRESHOLDS.review ? "待审核" : "已丢弃";

  return {
    name,
    brand,
    province,
    city,
    contact,
    address,
    leadType,
    sourcePlatform,
    sourceUrl: url,
    matchScore: scoring.score,
    reviewStatus,
    rawTitle: title,
    rawSummary: excerpt,
    scoreReasons: [...scoring.reasons, adapterContext.sourceHint ? `适配器：${adapterContext.sourceHint}` : ""].filter(Boolean),
    signals
  };
}

module.exports = {
  buildLeadFromHtml
};
