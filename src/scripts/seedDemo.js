/**
 * 文件说明：该文件是本地演示数据初始化脚本。
 * 功能说明：将高定木作公开商务线索的演示任务与演示线索写入本地存储，便于直接查看后台效果。
 *
 * 结构概览：
 *   第一部分：执行演示数据写入
 */

const { ensureStorage, getDatabaseUrl } = require("../lib/storage");
const { seedDemoData } = require("../lib/demoData");

// ========== 第一部分：执行演示数据写入 ==========
(async () => {
  try {
    await ensureStorage();
    const { tasks, leads } = await seedDemoData();
    console.log(`演示数据已写入 PostgreSQL：${tasks.length} 个任务，${leads.length} 条线索。`);
    console.log(`当前数据库：${getDatabaseUrl()}`);
  } catch (error) {
    console.error(`演示数据写入失败：${error.message}`);
    process.exitCode = 1;
  }
})();
