/**
 * 文件说明：该文件提供抽取规则样本检查脚本。
 * 功能说明：使用固定公开商务样本文本检查品牌、地址、联系方式是否能被稳定提取，便于后续回归验证。
 *
 * 结构概览：
 *   第一部分：样本定义
 *   第二部分：断言与打印工具
 *   第三部分：主流程
 */

const { buildLeadFromHtml } = require("../lib/extractor");

// ========== 第一部分：样本定义 ==========
const task = {
  province: "浙江",
  city: "杭州"
};

const cases = [
  {
    name: "官网品牌方与总部地址",
    url: "https://demo.woodxu.cn/about",
    html: `
      <html>
        <head>
          <title>木序高定木作</title>
          <meta property="og:site_name" content="木序高定" />
        </head>
        <body>
          <h1>木序高定木作展厅</h1>
          <p>品牌方：杭州木序家居有限公司</p>
          <p>总部地址：杭州市西湖区留和路88号木作中心2层</p>
          <p>电话：0571-88223366</p>
        </body>
      </html>
    `,
    expected: {
      brand: "木序",
      address: "杭州市西湖区留和路88号木作中心2层",
      contact: "0571-88223366"
    }
  },
  {
    name: "公众号联合品牌与到访地址",
    url: "https://mp.weixin.qq.com/s/demo-brand-address",
    html: `
      <html>
        <head><title>栖木木作美学馆开馆</title></head>
        <body>
          <h1>栖木木作美学馆</h1>
          <p>联合品牌：栖木 × 隐木</p>
          <p>到访地址：杭州市滨江区闻涛路166号美学馆A座</p>
          <p>预约电话：0571-86661218</p>
        </body>
      </html>
    `,
    expected: {
      brand: "栖木",
      address: "杭州市滨江区闻涛路166号美学馆A座",
      contact: "0571-86661218"
    }
  },
  {
    name: "地图接待中心地址",
    url: "https://www.amap.com/place/demo-wood-showroom",
    html: `
      <html>
        <head><title>隐山私宅木作工作室</title></head>
        <body>
          <h1>隐山私宅木作工作室</h1>
          <p>主理品牌：隐山私宅木作</p>
          <p>接待中心：杭州市拱墅区莫干山路501号接待中心3层</p>
          <p>联系电话：0571-81110992</p>
        </body>
      </html>
    `,
    expected: {
      brand: "隐山",
      address: "杭州市拱墅区莫干山路501号接待中心3层",
      contact: "0571-81110992"
    }
  }
];

// ========== 第二部分：断言与打印工具 ==========
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} 不匹配，期望 "${expected}"，实际 "${actual}"`);
  }
}

function printCaseResult(name, lead) {
  console.log(`\n=== ${name} ===`);
  console.log(`brand: ${lead.brand}`);
  console.log(`address: ${lead.address}`);
  console.log(`contact: ${lead.contact}`);
}

// ========== 第三部分：主流程 ==========
function main() {
  for (const item of cases) {
    const lead = buildLeadFromHtml({
      task,
      url: item.url,
      html: item.html
    });

    printCaseResult(item.name, lead);
    assertEqual(lead.brand, item.expected.brand, `${item.name} brand`);
    assertEqual(lead.address, item.expected.address, `${item.name} address`);
    assertEqual(lead.contact, item.expected.contact, `${item.name} contact`);
  }

  console.log("\n抽取样本检查通过。");
}

try {
  main();
} catch (error) {
  console.error(`抽取样本检查失败：${error.message}`);
  process.exit(1);
}
