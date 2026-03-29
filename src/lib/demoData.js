/**
 * 文件说明：该文件提供本地可重复的演示数据。
 * 功能说明：生成仅包含公开商务字段的高定木作线索样例，便于在不依赖公网抓取时演示后台流程。
 *
 * 结构概览：
 *   第一部分：时间工具
 *   第二部分：任务样例
 *   第三部分：线索样例
 *   第四部分：演示数据写入函数
 */

const { replaceAllData } = require("./storage");

// ========== 第一部分：时间工具 ==========
function offsetIso(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000).toISOString();
}

// ========== 第二部分：任务样例 ==========
function buildDemoTasks(now) {
  return [
    {
      id: "task_demo_hz_001",
      province: "浙江",
      city: "杭州",
      keyword: "高定木作 展厅",
      plannedCount: 1200,
      sourceScope: ["搜索结果", "官网", "公众号"],
      completedCount: 6,
      successCount: 4,
      failureCount: 2,
      status: "completed",
      latestProgress: {
        stage: "completed",
        message: "任务完成，省级范围内已筛出高优先公开商务线索",
        processedCount: 6,
        targetCount: 1200,
        currentUrl: "https://demo.woodxu.cn/showroom/hangzhou",
        currentQuery: "浙江 杭州 高定木作 展厅",
        updatedAt: offsetIso(now, -5)
      },
      failureSamples: [
        {
          at: offsetIso(now, -180),
          url: "https://mp.weixin.qq.com/s/demo-timeout-001",
          error: "公众号页返回 502，已跳过"
        },
        {
          at: offsetIso(now, -95),
          url: "https://demo.woodxu.cn/contact",
          error: "页面读取超时，第二轮仍失败"
        }
      ],
      retryRecords: [
        {
          at: offsetIso(now, -210),
          stage: "candidate_search",
          attempt: 1,
          query: "浙江 杭州 高定木作 展厅 site:mp.weixin.qq.com",
          error: "请求超时，已自动重试"
        },
        {
          at: offsetIso(now, -96),
          stage: "page_fetch",
          attempt: 1,
          url: "https://demo.woodxu.cn/contact",
          error: "首次连接超时，准备第二次抓取"
        },
        {
          at: offsetIso(now, -32),
          stage: "page_fetch",
          attempt: 1,
          url: "https://demo.woodxu.cn/showroom/hangzhou",
          error: "页面首轮响应过慢，第二轮成功"
        }
      ],
      createdAt: offsetIso(now, -300),
      startedAt: offsetIso(now, -295),
      finishedAt: offsetIso(now, -5),
      lastError: "页面读取超时，第二轮仍失败"
    },
    {
      id: "task_demo_sh_002",
      province: "上海",
      city: "上海",
      keyword: "私宅木作 工作室",
      plannedCount: 800,
      sourceScope: ["搜索结果", "官网", "地图"],
      completedCount: 3,
      successCount: 2,
      failureCount: 1,
      status: "completed",
      latestProgress: {
        stage: "completed",
        message: "任务完成，存在少量地图页抓取失败样本",
        processedCount: 3,
        targetCount: 800,
        currentUrl: "https://demo.yinshan-wood.com/studio",
        currentQuery: "上海 私宅木作 工作室 地图",
        updatedAt: offsetIso(now, -12)
      },
      failureSamples: [
        {
          at: offsetIso(now, -78),
          url: "https://ditu.example.com/demo-failed-map-item",
          error: "页面返回 429，已跳过"
        }
      ],
      retryRecords: [
        {
          at: offsetIso(now, -79),
          stage: "page_fetch",
          attempt: 1,
          url: "https://demo.yinshan-wood.com/studio",
          error: "首次连接超时，第二次成功"
        }
      ],
      createdAt: offsetIso(now, -180),
      startedAt: offsetIso(now, -176),
      finishedAt: offsetIso(now, -12),
      lastError: "页面返回 429，已跳过"
    }
  ];
}

// ========== 第三部分：线索样例 ==========
function buildDemoLeads(now) {
  return [
    {
      id: "lead_demo_001",
      taskId: "task_demo_hz_001",
      name: "木序高定木作展厅",
      brand: "木序",
      province: "浙江",
      city: "杭州",
      contact: "0571-88223366",
      address: "杭州市西湖区留和路 88 号木作设计中心 2 层",
      leadType: "高定木作",
      sourcePlatform: "官网",
      sourceUrl: "https://demo.woodxu.cn/showroom/hangzhou",
      matchScore: 94,
      reviewStatus: "已保留",
      rawTitle: "木序高定木作展厅 - 杭州私宅木作方案中心",
      rawSummary: "公开页面显示该展厅提供高定木作、木门墙柜一体、护墙木作与私宅定制服务，附公开电话和展厅地址。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+30 命中高定木作", "+15 存在联系方式", "+10 存在地址", "+10 存在城市", "+10 存在品牌"],
      createdAt: offsetIso(now, -250),
      updatedAt: offsetIso(now, -245)
    },
    {
      id: "lead_demo_002",
      taskId: "task_demo_hz_001",
      name: "栖木木作美学馆",
      brand: "栖木",
      province: "浙江",
      city: "杭州",
      contact: "0571-86661218",
      address: "杭州市滨江区闻涛路 166 号美学馆 A 座",
      leadType: "木作展厅",
      sourcePlatform: "公众号",
      sourceUrl: "https://mp.weixin.qq.com/s/demo-hz-wood-aesthetic",
      matchScore: 88,
      reviewStatus: "待审核",
      rawTitle: "栖木木作美学馆开馆 | 杭州高定木作体验空间",
      rawSummary: "页面正文包含高定木作、木作美学馆、木饰面、楼梯木作等词，并公开展示展厅地址与联系电话。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+25 命中木作展厅", "+10 存在空间属性词", "+15 存在联系方式", "+10 存在地址", "+10 存在品牌"],
      createdAt: offsetIso(now, -170),
      updatedAt: offsetIso(now, -165)
    },
    {
      id: "lead_demo_003",
      taskId: "task_demo_hz_001",
      name: "原境原木定制中心",
      brand: "原境",
      province: "浙江",
      city: "杭州",
      contact: "0571-81110992",
      address: "杭州市拱墅区莫干山路 501 号原木定制中心",
      leadType: "原木定制",
      sourcePlatform: "搜索结果",
      sourceUrl: "https://www.bing.com/search?q=%E6%9D%AD%E5%B7%9E+%E5%8E%9F%E6%9C%A8%E5%AE%9A%E5%88%B6+%E5%B1%95%E5%8E%85",
      matchScore: 83,
      reviewStatus: "待审核",
      rawTitle: "原境原木定制中心 | 杭州高端私宅木作",
      rawSummary: "公开文本展示原木定制、私宅木作、木饰面及展厅参观预约入口，保留来源链接便于人工核验。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+15 命中原木定制", "+10 存在品牌", "+15 存在联系方式", "+10 存在地址", "+10 存在城市"],
      createdAt: offsetIso(now, -125),
      updatedAt: offsetIso(now, -124)
    },
    {
      id: "lead_demo_004",
      taskId: "task_demo_hz_001",
      name: "木映私宅木作工作室",
      brand: "木映",
      province: "浙江",
      city: "杭州",
      contact: "0571-89930081",
      address: "杭州市余杭区良渚大道 520 号私宅木作工作室",
      leadType: "私宅木作",
      sourcePlatform: "官网",
      sourceUrl: "https://demo.muying-wood.cn/private-house",
      matchScore: 86,
      reviewStatus: "待审核",
      rawTitle: "木映私宅木作工作室 | 杭州别墅木作与护墙系统",
      rawSummary: "公开官网正文提到私宅木作、别墅木作、护墙系统和原木定制，页面可直接查看电话与工作室地址。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+20 命中私宅木作", "+10 命中空间属性词", "+15 存在联系方式", "+10 存在地址", "+10 存在品牌"],
      createdAt: offsetIso(now, -90),
      updatedAt: offsetIso(now, -88)
    },
    {
      id: "lead_demo_005",
      taskId: "task_demo_sh_002",
      name: "隐山私宅木作工作室",
      brand: "隐山",
      province: "上海",
      city: "上海",
      contact: "021-64220018",
      address: "上海市徐汇区龙腾大道 2879 号私宅木作工作室",
      leadType: "私宅木作",
      sourcePlatform: "官网",
      sourceUrl: "https://demo.yinshan-wood.com/studio",
      matchScore: 91,
      reviewStatus: "已保留",
      rawTitle: "隐山私宅木作工作室 | 上海别墅木作与高定系统",
      rawSummary: "公开官网信息包含私宅木作、高端私宅、护墙木作、衣帽间、楼梯木作等内容，并披露公开电话和工作室地址。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+20 命中私宅木作", "+10 存在品牌", "+15 存在联系方式", "+10 存在地址", "+10 存在城市"],
      createdAt: offsetIso(now, -72),
      updatedAt: offsetIso(now, -70)
    },
    {
      id: "lead_demo_006",
      taskId: "task_demo_sh_002",
      name: "合木全案工作室",
      brand: "合木",
      province: "上海",
      city: "上海",
      contact: "021-60225531",
      address: "上海市闵行区申长路 1588 号设计事务所 3 层",
      leadType: "全案工作室",
      sourcePlatform: "行业平台",
      sourceUrl: "https://www.shejiben.com/demo/hemu-wood",
      matchScore: 79,
      reviewStatus: "待审核",
      rawTitle: "合木全案工作室 | 私宅木作系统与木门墙柜一体方案",
      rawSummary: "虽然名称中带全案工作室，但正文同时命中木门墙柜一体、私宅木作和木饰面，因此保留进入人工审核池。",
      duplicateState: "normal",
      duplicateOf: "",
      scoreReasons: ["+20 全案工作室伴随强木作信号", "+20 命中木门墙柜一体", "+15 存在联系方式", "+10 存在地址"],
      createdAt: offsetIso(now, -40),
      updatedAt: offsetIso(now, -38)
    }
  ];
}

// ========== 第四部分：演示数据写入函数 ==========
async function seedDemoData() {
  const now = new Date();
  const tasks = buildDemoTasks(now);
  const leads = buildDemoLeads(now);
  await replaceAllData({ tasks, leads });
  return { tasks, leads };
}

module.exports = {
  seedDemoData
};
