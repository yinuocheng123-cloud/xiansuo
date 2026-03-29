/**
 * 文件说明：该文件实现线索 CSV 导出功能。
 * 功能说明：仅导出已保留线索的 10 个核心业务字段，便于后续导入 Excel 或其他系统。
 *
 * 结构概览：
 *   第一部分：转义函数
 *   第二部分：CSV 生成
 */

// ========== 第一部分：转义函数 ==========
function escapeCsv(value) {
  const content = String(value ?? "");
  if (/[",\n]/.test(content)) {
    return `"${content.replace(/"/g, "\"\"")}"`;
  }

  return content;
}

// ========== 第二部分：CSV 生成 ==========
function leadsToCsv(leads) {
  const headers = [
    "名称",
    "品牌",
    "城市",
    "联系方式",
    "地址",
    "线索类型",
    "来源平台",
    "来源链接",
    "匹配分",
    "审核状态"
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.brand,
    lead.city,
    lead.contact,
    lead.address,
    lead.leadType,
    lead.sourcePlatform,
    lead.sourceUrl,
    lead.matchScore,
    lead.reviewStatus
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

module.exports = {
  leadsToCsv
};
