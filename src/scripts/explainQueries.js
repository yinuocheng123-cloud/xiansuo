/**
 * 文件说明：该文件提供数据库执行计划检查脚本。
 * 功能说明：自动连接当前项目 PostgreSQL，检查关键查询的 EXPLAIN 结果，帮助确认组合索引是否命中预期路径。
 *
 * 结构概览：
 *   第一部分：依赖与查询定义
 *   第二部分：执行计划打印工具
 *   第三部分：主流程
 */

const { Client } = require("pg");
const { ensureStorage, getDatabaseUrl } = require("../lib/storage");

// ========== 第一部分：依赖与查询定义 ==========
const EXPLAIN_QUERIES = [
  {
    name: "task_detail_recent_leads",
    expected: "idx_leads_task_score_created",
    sql: "explain (costs off) select * from leads where task_id = 'task_demo_hz_001' order by match_score desc, created_at desc limit 20"
  },
  {
    name: "results_review_status",
    expected: "idx_leads_review_status_score_created",
    sql: "explain (costs off) select * from leads where review_status = '待审核' order by match_score desc, created_at desc limit 50"
  },
  {
    name: "results_region_filter",
    expected: "idx_leads_region_score_created",
    sql: "explain (costs off) select * from leads where province = '浙江' and city = '杭州' order by match_score desc, created_at desc limit 50"
  },
  {
    name: "results_platform_type_filter",
    expected: "idx_leads_platform_type_score_created",
    sql: "explain (costs off) select * from leads where source_platform = '官网' and lead_type = '私宅木作' order by match_score desc, created_at desc limit 50"
  },
  {
    name: "results_brand_filter_default",
    expected: "idx_leads_brand_trgm",
    sql: "explain (costs off) select * from leads where brand ilike '%木序%' order by match_score desc, created_at desc limit 50"
  }
];

// ========== 第二部分：执行计划打印工具 ==========
function planUsesExpectedIndex(planLines, expectedIndex) {
  return planLines.some((line) => line.includes(expectedIndex));
}

function printPlanBlock(title, planLines, matched, expectedIndex) {
  console.log(`\n=== ${title} ===`);
  console.log(planLines.join("\n"));
  console.log(`=> 预期索引：${expectedIndex}`);
  console.log(`=> 当前判断：${matched ? "已命中预期索引" : "未直接命中预期索引"}`);
}

// ========== 第三部分：主流程 ==========
async function main() {
  await ensureStorage();

  const client = new Client({
    connectionString: getDatabaseUrl()
  });

  await client.connect();

  try {
    let hasFailure = false;

    for (const item of EXPLAIN_QUERIES) {
      const result = await client.query(item.sql);
      const planLines = result.rows.map((row) => row["QUERY PLAN"]);
      const matched = planUsesExpectedIndex(planLines, item.expected);
      printPlanBlock(item.name, planLines, matched, item.expected);

      if (!matched && item.name !== "results_brand_filter_default") {
        hasFailure = true;
      }
    }

    // 品牌模糊筛选在小样本下可能偏向顺序扫描，这里额外用关闭顺扫偏好的方式确认 trigram 索引可参与。
    await client.query("set enable_seqscan = off");
    const forced = await client.query("explain (costs off) select * from leads where brand ilike '%木序%' order by match_score desc, created_at desc limit 50");
    const forcedPlanLines = forced.rows.map((row) => row["QUERY PLAN"]);
    const forcedMatched = planUsesExpectedIndex(forcedPlanLines, "idx_leads_brand_trgm");
    printPlanBlock("results_brand_filter_forced_index", forcedPlanLines, forcedMatched, "idx_leads_brand_trgm");

    if (!forcedMatched) {
      hasFailure = true;
    }

    if (hasFailure) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`执行计划检查失败：${error.message}`);
  process.exit(1);
});
