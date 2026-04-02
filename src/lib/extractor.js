/**
 * 文件说明：该文件实现页面字段提取逻辑。
 * 功能说明：从公开网页 HTML 中提取线索核心字段，并结合来源适配器提升品牌、地址、联系方式的识别精度。
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
  "设计中心",
  "品牌方",
  "品牌主理",
  "联合品牌",
  "品牌总部",
  "运营品牌",
  "项目品牌",
  "城市展厅"
];

const BRAND_SUFFIX_PATTERN = /(?:\u9ad8\u5b9a\u6728\u4f5c|\u79c1\u5b85\u6728\u4f5c|\u6728\u4f5c\u5c55\u5385|\u6728\u4f5c\u7f8e\u5b66\u9986|\u539f\u6728\u5b9a\u5236|\u5168\u6848\u5de5\u4f5c\u5ba4|\u6728\u4f5c\u7cfb\u7edf|\u6728\u4f5c|\u5de5\u4f5c\u5ba4|\u5c55\u5385|\u7f8e\u5b66\u9986|\u4f53\u9a8c\u9986|\u8bbe\u8ba1\u4e2d\u5fc3)$/u;
const BRAND_CORE_PATTERN = /^([\u4e00-\u9fa5A-Za-z0-9]{2,16})(?:\u9ad8\u5b9a\u6728\u4f5c|\u79c1\u5b85\u6728\u4f5c|\u6728\u4f5c\u5c55\u5385|\u6728\u4f5c\u7f8e\u5b66\u9986|\u539f\u6728\u5b9a\u5236|\u5168\u6848\u5de5\u4f5c\u5ba4|\u6728\u4f5c\u7cfb\u7edf|\u6728\u4f5c|\u5de5\u4f5c\u5ba4|\u5c55\u5385|\u7f8e\u5b66\u9986|\u4f53\u9a8c\u9986|\u8bbe\u8ba1\u4e2d\u5fc3)/u;
const COMPANY_REGION_PREFIX_PATTERN = /^(?:\u4e2d\u56fd|[\u4e00-\u9fa5]{2,6}(?:\u7701|\u5e02))/u;
const COMPANY_SUFFIX_PATTERN = /(?:\u6709\u9650\u8d23\u4efb\u516c\u53f8|\u6709\u9650\u516c\u53f8|\u96c6\u56e2|\u5b9e\u4e1a|\u5bb6\u5c45\u79d1\u6280|\u7a7a\u95f4\u8bbe\u8ba1|\u5ba4\u5185\u8bbe\u8ba1|\u8bbe\u8ba1\u54a8\u8be2|\u8bbe\u8ba1|\u5bb6\u5c45|\u6728\u4e1a|\u6728\u4f5c\u7cfb\u7edf|\u6728\u4f5c|\u5b9a\u5236|\u88c5\u9970)$/u;
const ADDRESS_REGION_START_PATTERN = /^.*?(?=(?:\u4e2d\u56fd)?[\u4e00-\u9fa5]{2,8}(?:\u7701|\u5e02))/u;
const TRAILING_PHONE_PATTERN = /\s*(?:\u7535\u8bdd|\u8054\u7cfb\u7535\u8bdd|\u9884\u7ea6\u7535\u8bdd|\u70ed\u7ebf)[:：]?\s*(?:0\d{2,3}[- ]?\d{7,8}|1[3-9]\d{9}).*$/u;
const ADDRESS_NOISE_PATTERN = /[；;，,。]\s*(?:\u7535\u8bdd|\u70ed\u7ebf|\u9884\u7ea6|\u5bfc\u822a|\u8425\u4e1a\u65f6\u95f4|\u5f00\u653e\u65f6\u95f4|\u5de5\u4f5c\u65f6\u95f4|\u6b22\u8fce\u5230\u5e97|\u6b22\u8fce\u9884\u7ea6|\u54c1\u724c\u65b9|\u4e3b\u7406\u54c1\u724c|\u8054\u5408\u54c1\u724c).*/u;

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
  const cleaned = cleanName(value)
    .replace(/^(品牌名称|品牌归属|所属品牌|品牌|公司名称|公众号|账号名称|主理品牌|品牌主理|品牌方|联合品牌|品牌总部|运营品牌|项目品牌|品牌门店|门店归属|展厅品牌)[:：]?\s*/i, "")
    .replace(/(官网首页|官方网站|官方账号)$/i, "")
    .trim();

  // 联合品牌文本通常只适合保留首个主品牌，避免把多个品牌直接写入单值字段。
  const normalized = cleaned
    .split(/\s*(?:×|x|X|&|\/|／|、)\s*/)[0]
    .replace(BRAND_SUFFIX_PATTERN, "")
    .trim();

  const brandCoreMatch = normalized.match(BRAND_CORE_PATTERN);
  if (brandCoreMatch) {
    return brandCoreMatch[1];
  }

  return normalized;
}

function simplifyCompanyBrandName(value) {
  const original = cleanBrandCandidate(value);
  const simplified = original
    .replace(COMPANY_REGION_PREFIX_PATTERN, "")
    .replace(COMPANY_SUFFIX_PATTERN, "")
    .trim();

  if (simplified.length >= 2 && simplified.length <= 10) {
    return simplified;
  }

  return original;
}

function isBrandLike(value, currentName = "") {
  const text = cleanBrandCandidate(value);
  if (!text || text.length < 2 || text.length > 24) {
    return false;
  }

  if (/[0-9]{5,}/.test(text) || /(电话|地址|联系|预约|导航|中心地址|展厅地址|接待中心)/.test(text)) {
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
    .replace(/^(展厅地址|门店地址|联系地址|公司地址|详细地址|项目地址|导航地址|地址|位置|总部地址|运营中心地址|服务地址|参观地址|预约地址|到访地址|到店地址|接待中心|体验中心|城市展厅|展厅位置)[:：]?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(ADDRESS_NOISE_PATTERN, "")
    .replace(TRAILING_PHONE_PATTERN, "")
    // 候选值有时会带入标题或摘要前缀，这里截到第一个明确的省市起点。
    .replace(ADDRESS_REGION_START_PATTERN, "")
    .trim();
}

function isAddressLike(value) {
  const text = cleanAddressCandidate(value);
  if (!text || text.length < 6) {
    return false;
  }

  return /(省|市|区|县|镇|街|路|道|号|广场|大厦|园|中心|层|室|展厅|馆|接待)/.test(text);
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
  const prefixMatch = cleanedName.match(BRAND_CORE_PATTERN);
  if (prefixMatch && isBrandLike(prefixMatch[1], cleanedName)) {
    return prefixMatch[1];
  }

  const adapterBrand = pickFirstValid(
    (adapterContext.brandCandidates || []).map((line) => cleanBrandCandidate(normalizeLineValue(line, /^(品牌名称|品牌归属|所属品牌|品牌|公众号|账号名称|公司名称|商户|门店|主理品牌|品牌主理|品牌方|联合品牌|品牌总部|运营品牌|项目品牌|品牌门店|门店归属|展厅品牌)[:：]?\s*/))),
    (value) => isBrandLike(value, cleanedName)
  );
  if (adapterBrand) {
    return adapterBrand;
  }

  const companyBrand = pickFirstValid(
    (adapterContext.brandCandidates || []).map((line) => simplifyCompanyBrandName(line)),
    (value) => isBrandLike(value, cleanedName)
  );
  if (companyBrand) {
    return companyBrand;
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
    /(?:展厅地址|门店地址|联系地址|公司地址|地址|体验馆地址|项目地址|总部地址|运营中心地址|服务地址|参观地址|预约地址|到访地址|到店地址|接待中心|体验中心|城市展厅|展厅位置)[:：]?\s*([^\n。；;]{6,120})/i,
    /((?:[\u4e00-\u9fa5]{2,8}(?:省|市))?[\u4e00-\u9fa5]{2,12}(?:区|县|镇|街道)[\u4e00-\u9fa5A-Za-z0-9\-路街道号弄室层座栋单元广场大厦园中心馆展厅体验接待]{4,100})/,
    /((?:[\u4e00-\u9fa5]{2,8}(?:市|区))[\u4e00-\u9fa5A-Za-z0-9\-路街道号弄室层座栋单元广场大厦园中心馆展厅体验接待]{6,100})/
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
  const rawBrand = inferBrand(name, url, joinedText, html, adapterContext);
  const brand = pickFirstValid(
    [cleanBrandCandidate(rawBrand), simplifyCompanyBrandName(rawBrand), rawBrand],
    (value) => isBrandLike(value, name)
  );
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
  buildLeadFromHtml,
  cleanBrandCandidate,
  cleanAddressCandidate,
  simplifyCompanyBrandName
};
