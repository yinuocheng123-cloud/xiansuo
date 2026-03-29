/**
 * 文件说明：该文件实现 MVP 的公开候选页发现逻辑。
 * 功能说明：根据任务中的城市、关键词和来源范围构造搜索查询，并从公开搜索结果页提取候选链接。
 *
 * 结构概览：
 *   第一部分：查询构造
 *   第二部分：候选链接提取
 */

const { fetchTextWithRetry } = require("../http");

// ========== 第一部分：查询构造 ==========
function buildQueries(task) {
  const regionParts = [task.province, task.city].filter((value, index, array) => value && array.indexOf(value) === index);
  const base = `${regionParts.join(" ")} ${task.keyword}`.trim();
  const sourceScope = Array.isArray(task.sourceScope) && task.sourceScope.length > 0 ? task.sourceScope : ["搜索结果", "官网", "公众号"];
  const querySet = new Set([`${base} 高定木作 公开商务`]);

  for (const scope of sourceScope) {
    if (scope === "官网") {
      querySet.add(`${base} 官网 展厅 联系方式 地址`);
      querySet.add(`${base} site:.cn 联系我们 木作`);
    }

    if (scope === "公众号") {
      querySet.add(`${base} site:mp.weixin.qq.com`);
      querySet.add(`${base} 公众号 展厅 地址 site:mp.weixin.qq.com`);
    }

    if (scope === "抖音") {
      querySet.add(`${base} site:www.douyin.com`);
    }

    if (scope === "小红书") {
      querySet.add(`${base} site:www.xiaohongshu.com`);
    }

    if (scope === "地图") {
      querySet.add(`${base} 地址 电话 展厅 地图`);
      querySet.add(`${base} 店铺 地址 电话 高定木作`);
    }
  }

  return Array.from(querySet);
}

function extractOutboundLinks(html) {
  const links = new Set();
  const regex = /<li class="b_algo"[\s\S]*?<a href="(https?:\/\/[^"]+)"/gi;
  let match;

  while ((match = regex.exec(html))) {
    const url = match[1];

    if (/bing\.com|microsoft\.com/i.test(url)) {
      continue;
    }

    links.add(url);
  }

  return Array.from(links);
}

// ========== 第二部分：候选链接提取 ==========
async function searchPublicCandidates(task, limit = 20, hooks = {}) {
  const queries = buildQueries(task);
  const candidates = new Set();
  const pageSize = 50;
  const maxPages = Math.min(100, Math.max(1, Math.ceil(limit / pageSize)));

  for (const query of queries) {
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const first = pageIndex * pageSize + 1;
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${pageSize}&first=${first}`;

      if (typeof hooks.onProgress === "function") {
        await hooks.onProgress({
          stage: "candidate_search",
          query,
          pageIndex,
          first,
          foundCount: candidates.size
        });
      }

      const html = await fetchTextWithRetry(searchUrl, {
        retries: 1,
        timeoutMs: 12000,
        onRetry: hooks.onRetry ? (payload) => hooks.onRetry({ ...payload, stage: "candidate_search", query }) : null
      });

      const links = extractOutboundLinks(html);
      if (links.length === 0) {
        break;
      }

      for (const url of links) {
        candidates.add(url);

        if (candidates.size >= limit) {
          return Array.from(candidates);
        }
      }
    }
  }

  return Array.from(candidates);
}

module.exports = {
  searchPublicCandidates
};
