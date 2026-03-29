/**
 * 文件说明：该文件实现按来源平台区分的页面适配器。
 * 功能说明：针对地图、官网、公众号三类来源输出更细的名称、品牌、地址、联系方式候选值。
 *
 * 结构概览：
 *   第一部分：通用候选提取工具
 *   第二部分：地图、官网、公众号适配器
 *   第三部分：统一入口
 */

const { extractMetaContent, extractTextLines, extractJsonLdObjects } = require("../html");

// ========== 第一部分：通用候选提取工具 ==========
function uniqueValues(values) {
  return Array.from(new Set(values.flat().map((value) => String(value || "").trim()).filter(Boolean)));
}

function cleanLineCandidate(line, labelPattern) {
  return String(line || "")
    .replace(labelPattern, "")
    .replace(/^\s*[:：]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLineCandidates(text, patterns) {
  const lines = extractTextLines(text);
  const matches = [];

  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      matches.push(line);
    }
  }

  return uniqueValues(matches);
}

function getLabelValueCandidates(text, labelPatterns) {
  return uniqueValues(
    getLineCandidates(text, labelPatterns).map((line) => cleanLineCandidate(line, /^(品牌名称|品牌归属|所属品牌|主理品牌|合作品牌|品牌馆|品牌|商户名称|商户|门店名称|门店|展厅名称|展厅|馆名|工作室名称|工作室|公司名称|公众号|账号名称|项目地址|展厅地址|门店地址|公司地址|联系地址|地址|详细地址|位置|导航地址)[:：]?\s*/))
  );
}

function extractNamedContactCandidates(text) {
  const matches = [];
  const regex = /(?:电话|联系电话|联系热线|服务热线|咨询电话|门店电话|展厅电话|预约电话)[:：]?\s*((?:0\d{2,3}[- ]?\d{7,8}|1[3-9]\d{9}))/gi;
  let match;

  while ((match = regex.exec(String(text || "")))) {
    matches.push(match[1]);
  }

  return uniqueValues(matches);
}

function splitMetaKeywords(content) {
  return uniqueValues(String(content || "").split(/[，,、|]/).map((item) => item.trim()));
}

function extractJsonLdCandidates(html) {
  const objects = extractJsonLdObjects(html);
  const names = [];
  const brands = [];
  const addresses = [];
  const contacts = [];

  for (const item of objects) {
    if (item.name) {
      names.push(item.name);
    }

    if (item.alternateName) {
      names.push(item.alternateName);
    }

    if (item.legalName) {
      brands.push(item.legalName);
    }

    if (item.brand) {
      if (typeof item.brand === "string") {
        brands.push(item.brand);
      } else if (item.brand.name) {
        brands.push(item.brand.name);
      }
    }

    if (item.publisher && item.publisher.name) {
      brands.push(item.publisher.name);
    }

    if (item.parentOrganization && item.parentOrganization.name) {
      brands.push(item.parentOrganization.name);
    }

    if (item.worksFor && item.worksFor.name) {
      brands.push(item.worksFor.name);
    }

    if (item.address) {
      if (typeof item.address === "string") {
        addresses.push(item.address);
      } else {
        addresses.push([
          item.address.addressRegion,
          item.address.addressLocality,
          item.address.streetAddress
        ].filter(Boolean).join(""));
      }
    }

    if (item.telephone) {
      contacts.push(item.telephone);
    }
  }

  return {
    names: uniqueValues(names),
    brands: uniqueValues(brands),
    addresses: uniqueValues(addresses),
    contacts: uniqueValues(contacts)
  };
}

function buildSharedCandidates({ title, h1, text, html }) {
  const jsonLd = extractJsonLdCandidates(html);
  const metaTitle = [
    extractMetaContent(html, "og:title"),
    extractMetaContent(html, "twitter:title"),
    extractMetaContent(html, "application-name")
  ];
  const siteNames = [
    extractMetaContent(html, "og:site_name"),
    extractMetaContent(html, "application-name"),
    extractMetaContent(html, "author"),
    extractMetaContent(html, "profile_nickname")
  ];
  const metaDescriptions = [
    extractMetaContent(html, "description"),
    extractMetaContent(html, "og:description")
  ];
  const metaKeywords = splitMetaKeywords(extractMetaContent(html, "keywords"));

  return {
    jsonLd,
    nameCandidates: uniqueValues([jsonLd.names, h1, title, metaTitle]),
    brandCandidates: uniqueValues([jsonLd.brands, siteNames, metaKeywords, metaDescriptions]),
    addressCandidates: uniqueValues([jsonLd.addresses]),
    contactCandidates: uniqueValues([jsonLd.contacts, extractNamedContactCandidates(text)])
  };
}

// ========== 第二部分：地图、官网、公众号适配器 ==========
function buildMapAdapter({ title, h1, text, html }) {
  const shared = buildSharedCandidates({ title, h1, text, html });
  return {
    nameCandidates: uniqueValues([
      shared.nameCandidates,
      getLabelValueCandidates(text, [/商户名称/i, /门店名称/i, /展厅名称/i, /工作室名称/i]),
      getLineCandidates(text, [/展厅/i, /体验馆/i, /美学馆/i, /工作室/i, /门店/i, /私宅木作/i])
    ]),
    brandCandidates: uniqueValues([
      shared.brandCandidates,
      getLabelValueCandidates(text, [/品牌名称/i, /所属品牌/i, /品牌归属/i, /主理品牌/i, /品牌门店/i, /门店归属/i, /展厅品牌/i, /品牌/i, /商户/i, /门店/i]),
      getLineCandidates(text, [/品牌馆/i, /高定品牌/i, /木作品牌/i, /品牌归属/i, /主理品牌/i]).map((line) => cleanLineCandidate(line, /^.*?(品牌馆|高定品牌|木作品牌|品牌归属|主理品牌)[:：]?\s*/))
    ]),
    addressCandidates: uniqueValues([
      shared.addressCandidates,
      getLabelValueCandidates(text, [/地址/i, /所在地址/i, /详细地址/i, /位置/i, /导航地址/i, /门店地址/i, /展馆地址/i, /展厅位置/i, /到店地址/i]),
      getLineCandidates(text, [/市.+路/i, /市.+号/i, /区.+路/i, /区.+号/i, /广场.+层/i, /中心.+层/i, /接待中心/i])
    ]),
    contactCandidates: uniqueValues([
      shared.contactCandidates,
      getLabelValueCandidates(text, [/电话/i, /联系/i, /热线/i, /预约/i])
    ]),
    sourceHint: "地图适配"
  };
}

function buildWechatAdapter({ title, h1, text, html }) {
  const shared = buildSharedCandidates({ title, h1, text, html });
  return {
    nameCandidates: uniqueValues([
      shared.nameCandidates,
      getLabelValueCandidates(text, [/展厅名称/i, /馆名/i, /工作室名称/i, /项目名称/i]),
      getLineCandidates(text, [/木作展厅/i, /美学馆/i, /工作室/i, /定制中心/i, /私宅木作/i])
    ]),
    brandCandidates: uniqueValues([
      shared.brandCandidates,
      getLabelValueCandidates(text, [/品牌名称/i, /所属品牌/i, /品牌归属/i, /公众号/i, /账号名称/i, /主理品牌/i, /品牌主理/i, /联合品牌/i, /品牌方/i, /品牌/i]),
      getLineCandidates(text, [/品牌/i, /主理品牌/i, /品牌主理/i, /木作品牌/i, /策展品牌/i, /联合品牌/i]).map((line) => cleanLineCandidate(line, /^.*?(品牌名称|所属品牌|品牌归属|品牌|主理品牌|品牌主理|木作品牌|策展品牌|联合品牌)[:：]?\s*/))
    ]),
    addressCandidates: uniqueValues([
      shared.addressCandidates,
      getLabelValueCandidates(text, [/展厅地址/i, /门店地址/i, /联系地址/i, /地址/i, /导航地址/i, /项目地址/i, /参观地址/i, /预约地址/i, /到访地址/i]),
      getLineCandidates(text, [/市.+路/i, /市.+号/i, /区.+路/i, /区.+号/i, /大道.+号/i, /中心.+层/i, /接待中心/i, /展厅.+层/i])
    ]),
    contactCandidates: uniqueValues([
      shared.contactCandidates,
      getLabelValueCandidates(text, [/电话/i, /预约/i, /咨询/i, /热线/i])
    ]),
    sourceHint: "公众号适配"
  };
}

function buildWebsiteAdapter({ title, h1, text, html }) {
  const shared = buildSharedCandidates({ title, h1, text, html });
  return {
    nameCandidates: uniqueValues([
      shared.nameCandidates,
      getLabelValueCandidates(text, [/展厅名称/i, /门店名称/i, /公司名称/i, /项目名称/i]),
      getLineCandidates(text, [/木作展厅/i, /体验馆/i, /美学馆/i, /设计中心/i, /工作室/i, /私宅木作/i])
    ]),
    brandCandidates: uniqueValues([
      shared.brandCandidates,
      getLabelValueCandidates(text, [/品牌名称/i, /品牌归属/i, /所属品牌/i, /公司名称/i, /主理品牌/i, /品牌总部/i, /运营品牌/i, /项目品牌/i, /品牌/i]),
      splitMetaKeywords(extractMetaContent(html, "description")).slice(0, 8),
      getLineCandidates(text, [/品牌理念/i, /品牌介绍/i, /品牌故事/i, /品牌总部/i, /运营品牌/i]).map((line) => cleanLineCandidate(line, /^.*?(品牌理念|品牌介绍|品牌故事|品牌总部|运营品牌)[:：]?\s*/))
    ]),
    addressCandidates: uniqueValues([
      shared.addressCandidates,
      getLabelValueCandidates(text, [/展厅地址/i, /门店地址/i, /公司地址/i, /联系地址/i, /地址/i, /体验馆地址/i, /项目地址/i, /总部地址/i, /运营中心地址/i, /服务地址/i, /城市展厅/i]),
      getLineCandidates(text, [/市.+路/i, /市.+号/i, /区.+路/i, /区.+号/i, /大道.+号/i, /广场.+室/i, /中心.+层/i, /接待中心/i, /体验中心/i])
    ]),
    contactCandidates: uniqueValues([
      shared.contactCandidates,
      getLabelValueCandidates(text, [/电话/i, /热线/i, /联系/i, /预约/i])
    ]),
    sourceHint: "官网适配"
  };
}

// ========== 第三部分：统一入口 ==========
function buildPageAdapterContext({ sourcePlatform, title, h1, text, html }) {
  const payload = { sourcePlatform, title, h1, text, html };

  if (sourcePlatform === "地图") {
    return buildMapAdapter(payload);
  }

  if (sourcePlatform === "公众号") {
    return buildWechatAdapter(payload);
  }

  return buildWebsiteAdapter(payload);
}

module.exports = {
  buildPageAdapterContext
};
