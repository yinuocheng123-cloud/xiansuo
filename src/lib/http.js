/**
 * 文件说明：该文件封装页面抓取时的网络请求工具。
 * 功能说明：提供超时、重试和请求间隔控制，避免形成攻击性抓取行为。
 *
 * 结构概览：
 *   第一部分：基础常量
 *   第二部分：等待与抓取函数
 */

// ========== 第一部分：基础常量 ==========
const DEFAULT_HEADERS = {
  "user-agent": "WoodLeadsMVP/0.1 (+public-business-leads-only)",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

// ========== 第二部分：等待与抓取函数 ==========
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithRetry(url, options = {}) {
  const {
    retries = 2,
    timeoutMs = 10000,
    headers = {},
    retryDelayMs = 1200,
    onRetry = null
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (attempt < retries) {
        if (typeof onRetry === "function") {
          await onRetry({
            url,
            attempt: attempt + 1,
            nextAttempt: attempt + 2,
            error: error.message
          });
        }
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError;
}

module.exports = {
  sleep,
  fetchTextWithRetry
};
