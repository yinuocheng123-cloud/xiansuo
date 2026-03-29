/**
 * 文件说明：该文件实现 MVP 的基础去重规则。
 * 功能说明：根据来源链接、名称+城市、联系方式与地址判断疑似重复，但不直接删除记录。
 *
 * 结构概览：
 *   第一部分：归一化工具
 *   第二部分：重复检测
 */

const { normalizeText } = require("./rules");

// ========== 第一部分：归一化工具 ==========
function normalizeUrl(url) {
  return String(url || "").trim().toLowerCase();
}

function normalizeContact(contact) {
  return String(contact || "").replace(/[^\d]/g, "");
}

function normalizeAddress(address) {
  return normalizeText(address);
}

// ========== 第二部分：重复检测 ==========
function detectDuplicate(existingLeads, candidate) {
  const sourceUrl = normalizeUrl(candidate.sourceUrl);
  const normalizedName = normalizeText(candidate.name);
  const normalizedCity = normalizeText(candidate.city);
  const normalizedContact = normalizeContact(candidate.contact);
  const normalizedAddress = normalizeAddress(candidate.address);

  for (const lead of existingLeads) {
    if (normalizeUrl(lead.sourceUrl) && normalizeUrl(lead.sourceUrl) === sourceUrl) {
      return { duplicateState: "source_url", duplicateOf: lead.id };
    }

    if (normalizeText(lead.name) === normalizedName && normalizeText(lead.city) === normalizedCity && normalizedName) {
      return { duplicateState: "name_city", duplicateOf: lead.id };
    }

    if (normalizedContact && normalizeContact(lead.contact) === normalizedContact) {
      return { duplicateState: "contact", duplicateOf: lead.id };
    }

    if (normalizedAddress && normalizeAddress(lead.address) === normalizedAddress) {
      return { duplicateState: "address", duplicateOf: lead.id };
    }
  }

  return { duplicateState: "normal", duplicateOf: "" };
}

module.exports = {
  detectDuplicate
};
