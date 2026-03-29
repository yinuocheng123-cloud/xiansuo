/**
 * 文件说明：该文件是 PostgreSQL 初始化脚本。
 * 功能说明：确保数据库存在并完成建表，便于首次运行时单独初始化存储层。
 *
 * 结构概览：
 *   第一部分：执行数据库初始化
 */

const { ensureStorage, getDatabaseUrl } = require("../lib/storage");

// ========== 第一部分：执行数据库初始化 ==========
(async () => {
  try {
    await ensureStorage();
    console.log(`PostgreSQL 初始化完成：${getDatabaseUrl()}`);
  } catch (error) {
    console.error(`PostgreSQL 初始化失败：${error.message}`);
    process.exitCode = 1;
  }
})();
