/**
 * 文件说明：该文件提供后台页面 HTML 渲染函数。
 * 功能说明：输出任务页、任务详情页、结果页、审核页和线索库页的服务端 HTML。
 *
 * 结构概览：
 *   第一部分：基础布局与通用渲染
 *   第二部分：任务页与任务详情页
 *   第三部分：结果页与审核页
 *   第四部分：线索库页
 */

// ========== 第一部分：基础布局与通用渲染 ==========
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout(title, content) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="shell">
      <div class="topbar">
        <div class="brand">
          <h1>高定木作公开商务线索采集系统</h1>
          <p>只采集公开商务信息，只服务高定木作业务方向。</p>
        </div>
        <nav class="nav">
          <a href="/tasks">任务页</a>
          <a href="/results">结果页</a>
          <a href="/library">线索库</a>
        </nav>
      </div>
      ${content}
    </div>
  </body>
</html>`;
}

function scoreClass(score) {
  if (score >= 80) {
    return "score-high";
  }

  if (score >= 60) {
    return "score-medium";
  }

  return "score-low";
}

function priorityLabel(score) {
  if (score >= 80) {
    return { label: "高优先", className: "tag success" };
  }

  if (score >= 60) {
    return { label: "人工审核", className: "tag warn" };
  }

  return { label: "低优先", className: "tag danger" };
}

function duplicateLabel(state) {
  const mapping = {
    source_url: "来源链接重复",
    name_city: "名称+城市重复",
    contact: "联系方式重复",
    address: "地址重复",
    normal: "无重复提示"
  };

  return mapping[state] || "无重复提示";
}

function renderReasons(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return `<span class="reason-item">暂无评分说明</span>`;
  }

  return reasons.map((reason) => `<span class="reason-item">${escapeHtml(reason)}</span>`).join("");
}

function taskRegionLabel(task) {
  return [task.province, task.city]
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .join(" / ") || "未指定";
}

function categorizeFailureReason(errorText) {
  const text = String(errorText || "").toLowerCase();

  if (!text) {
    return "其他异常";
  }

  if (/429|rate limit|限流|频率|too many requests/.test(text)) {
    return "频率限制";
  }

  if (/timeout|超时|timed out|响应过慢/.test(text)) {
    return "请求超时";
  }

  if (/502|503|504|server error|服务异常|网关/.test(text)) {
    return "服务端异常";
  }

  if (/403|forbidden|拒绝访问|无权限/.test(text)) {
    return "访问受限";
  }

  if (/dns|network|socket|connect|连接/.test(text)) {
    return "网络连接异常";
  }

  if (/parse|json|结构|提取|解析/.test(text)) {
    return "解析失败";
  }

  if (/404|不存在|not found/.test(text)) {
    return "页面不存在";
  }

  return "其他异常";
}

function renderTaskDiagnostics(task, options = {}) {
  const latestProgress = task.latestProgress || {};
  const failureSamples = Array.isArray(task.failureSamples) ? task.failureSamples : [];
  const retryRecords = Array.isArray(task.retryRecords) ? task.retryRecords : [];
  const compact = Boolean(options.compact);
  const visibleFailureSamples = compact ? failureSamples.slice(0, 2) : failureSamples;
  const visibleRetryRecords = compact ? retryRecords.slice(0, 4) : retryRecords;

  return `
    <div class="stack">
      <div class="notice">
        <strong>最近抓取进度</strong>
        <div class="meta-list">
          <span class="tag">${escapeHtml(latestProgress.stage || "pending")}</span>
          <span class="muted">${escapeHtml(latestProgress.message || "暂无进度信息")}</span>
        </div>
        <div class="meta-list" style="margin-top:8px;">
          <span class="muted">已处理：${escapeHtml(latestProgress.processedCount ?? task.completedCount ?? 0)} / ${escapeHtml(latestProgress.targetCount ?? task.plannedCount ?? 0)}</span>
          ${latestProgress.currentQuery ? `<span class="muted">当前查询：${escapeHtml(latestProgress.currentQuery)}</span>` : ""}
          ${latestProgress.currentUrl ? `<span class="muted break-all">当前链接：${escapeHtml(latestProgress.currentUrl)}</span>` : ""}
        </div>
      </div>
      <div class="notice">
        <strong>失败链接样本</strong>
        ${visibleFailureSamples.length > 0 ? visibleFailureSamples.map((item) => `<div class="muted break-all">${escapeHtml(item.at || "")} | ${escapeHtml(item.url || "")} | ${escapeHtml(item.error || "")}</div>`).join("") : `<div class="muted">暂无失败样本</div>`}
      </div>
      <div class="notice">
        <strong>重试记录</strong>
        ${visibleRetryRecords.length > 0 ? visibleRetryRecords.map((item) => `<div class="muted break-all">${escapeHtml(item.at || "")} | ${escapeHtml(item.stage || "")} | 第 ${escapeHtml(item.attempt || 0)} 次 | ${escapeHtml(item.url || item.query || "")} | ${escapeHtml(item.error || "")}</div>`).join("") : `<div class="muted">暂无重试记录</div>`}
      </div>
    </div>
  `;
}

function renderTaskStatePanel(task) {
  const latestProgress = task.latestProgress || {};

  return `
    <div class="detail-list">
      <div class="detail-item">
        <strong>任务状态</strong>
        <span class="tag">${escapeHtml(task.status)}</span>
      </div>
      <div class="detail-item">
        <strong>任务范围</strong>
        ${escapeHtml(taskRegionLabel(task))}
      </div>
      <div class="detail-item">
        <strong>计划数量</strong>
        ${escapeHtml(task.plannedCount)}
      </div>
      <div class="detail-item">
        <strong>已处理数量</strong>
        ${escapeHtml(task.completedCount)}
      </div>
      <div class="detail-item">
        <strong>成功 / 失败</strong>
        ${escapeHtml(`${task.successCount} / ${task.failureCount}`)}
      </div>
      <div class="detail-item">
        <strong>当前阶段</strong>
        ${escapeHtml(latestProgress.stage || "pending")}
      </div>
      <div class="detail-item">
        <strong>当前候选查询</strong>
        <span class="break-all">${escapeHtml(latestProgress.currentQuery || "暂无")}</span>
      </div>
      <div class="detail-item">
        <strong>当前候选页状态</strong>
        <span class="break-all">${escapeHtml(latestProgress.currentUrl || "暂无候选页")}</span>
      </div>
      <div class="detail-item">
        <strong>最近更新时间</strong>
        ${escapeHtml(latestProgress.updatedAt || task.finishedAt || task.createdAt || "")}
      </div>
      <div class="detail-item">
        <strong>最近错误</strong>
        ${escapeHtml(task.lastError || "无")}
      </div>
    </div>
  `;
}

function renderTaskLeadRows(leads) {
  if (!Array.isArray(leads) || leads.length === 0) {
    return `<tr><td colspan="7" class="muted">当前任务暂无线索</td></tr>`;
  }

  return leads.slice(0, 20).map((lead) => `
    <tr>
      <td>
        <strong>${escapeHtml(lead.name)}</strong><br />
        <span class="muted">${escapeHtml(lead.rawTitle || "")}</span>
      </td>
      <td>${escapeHtml(lead.brand)}</td>
      <td>${escapeHtml(lead.leadType)}</td>
      <td>${escapeHtml(lead.sourcePlatform)}</td>
      <td class="${scoreClass(lead.matchScore)}">${escapeHtml(lead.matchScore)}</td>
      <td><span class="tag">${escapeHtml(lead.reviewStatus)}</span></td>
      <td><a href="/review/${escapeHtml(lead.id)}">查看审核</a></td>
    </tr>
  `).join("");
}

function renderTaskEventTable(items, columns, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="muted">${escapeHtml(emptyText)}</div>`;
  }

  const rows = items.map((item) => `
    <tr>
      ${columns.map((column) => `<td class="${column.className || ""}">${escapeHtml(column.render(item))}</td>`).join("")}
    </tr>
  `).join("");

  return `
    <table>
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatTrendBucket(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${month}-${day} ${hour}:00`;
}

function buildTrendBuckets(items, getTimestamp, limit = 6) {
  const buckets = new Map();

  for (const item of items) {
    const timestamp = getTimestamp(item);
    if (!timestamp) {
      continue;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const key = formatTrendBucket(date);
    if (!buckets.has(key)) {
      buckets.set(key, { label: key, count: 0, sortValue: date.getTime() });
    }

    const current = buckets.get(key);
    current.count += 1;
    current.sortValue = Math.max(current.sortValue, date.getTime());
  }

  return Array.from(buckets.values())
    .sort((left, right) => right.sortValue - left.sortValue)
    .slice(0, limit);
}

function buildFailureReasonBuckets(failureSamples = [], retryRecords = []) {
  const buckets = new Map();

  for (const item of [...failureSamples, ...retryRecords]) {
    const reason = categorizeFailureReason(item.error || "");
    if (!buckets.has(reason)) {
      buckets.set(reason, { label: reason, count: 0 });
    }

    buckets.get(reason).count += 1;
  }

  return Array.from(buckets.values()).sort((left, right) => right.count - left.count);
}

function collectFailureReasonEvents(failureSamples = [], retryRecords = []) {
  return [...failureSamples, ...retryRecords]
    .map((item) => ({
      reason: categorizeFailureReason(item.error || ""),
      at: item.at || "",
      error: item.error || "",
      url: item.url || "",
      query: item.query || "",
      stage: item.stage || "",
      attempt: item.attempt || ""
    }))
    .filter((item) => item.reason)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
}

function buildReasonCountMap(events) {
  const counts = new Map();

  for (const item of events) {
    counts.set(item.reason, (counts.get(item.reason) || 0) + 1);
  }

  return counts;
}

function buildFailureReasonInsights(failureSamples = [], retryRecords = []) {
  const events = collectFailureReasonEvents(failureSamples, retryRecords);
  if (events.length === 0) {
    return {
      topReasons: [],
      changeHints: [],
      recentWindowSize: 0,
      topReasonRecentSamples: []
    };
  }

  const topReasons = buildFailureReasonBuckets(failureSamples, retryRecords)
    .slice(0, 3)
    .map((bucket, index) => ({
      rank: index + 1,
      label: bucket.label,
      count: bucket.count,
      ratio: Math.round((bucket.count / events.length) * 100)
    }));

  // 用最近半窗口和上一阶段窗口做轻量比较，避免引入更复杂的事件流模型。
  const recentWindowSize = Math.max(2, Math.min(6, Math.ceil(events.length / 2)));
  const recentEvents = events.slice(0, recentWindowSize);
  const previousEvents = events.slice(recentWindowSize, recentWindowSize * 2);
  const recentCounts = buildReasonCountMap(recentEvents);
  const previousCounts = buildReasonCountMap(previousEvents);
  const reasons = Array.from(new Set([...recentCounts.keys(), ...previousCounts.keys()]));

  const changeHints = reasons
    .map((reason) => {
      const recentCount = recentCounts.get(reason) || 0;
      const previousCount = previousCounts.get(reason) || 0;
      const delta = recentCount - previousCount;
      let trend = "持平";
      let summary = `最近窗口 ${recentCount} 次，上一阶段 ${previousCount} 次`;

      if (delta > 0) {
        trend = "上升";
        summary = `最近窗口 ${recentCount} 次，较上一阶段增加 ${delta} 次`;
      } else if (delta < 0) {
        trend = "回落";
        summary = `最近窗口 ${recentCount} 次，较上一阶段减少 ${Math.abs(delta)} 次`;
      }

      return {
        label: reason,
        trend,
        delta,
        summary
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || right.label.localeCompare(left.label, "zh-CN"))
    .slice(0, 3);

  return {
    topReasons,
    changeHints,
    recentWindowSize,
    topReasonRecentSamples: topReasons.length > 0
      ? events.filter((item) => item.reason === topReasons[0].label).slice(0, 3)
      : []
  };
}

function renderTrendPanel(title, buckets, emptyText, tone = "success") {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return `
      <section class="card half">
        <h2>${escapeHtml(title)}</h2>
        <div class="muted">${escapeHtml(emptyText)}</div>
      </section>
    `;
  }

  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return `
    <section class="card half">
      <h2>${escapeHtml(title)}</h2>
      <div class="trend-list">
        ${buckets.map((bucket) => `
          <div class="trend-item">
            <div class="trend-meta">
              <strong>${escapeHtml(bucket.label)}</strong>
              <span class="tag ${tone === "warn" ? "warn" : "success"}">${escapeHtml(bucket.count)} 次</span>
            </div>
            <div class="trend-bar">
              <span class="trend-bar-fill ${tone === "warn" ? "warn" : "success"}" style="width:${Math.max(12, Math.round((bucket.count / maxCount) * 100))}%"></span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderFailureReasonInsightPanel(insights) {
  if (!insights || insights.topReasons.length === 0) {
    return `
      <section class="card">
        <h2>失败原因 Top 摘要</h2>
        <div class="muted">暂无失败原因摘要</div>
      </section>
    `;
  }

  const trendClassMap = {
    上升: "tag danger",
    回落: "tag success",
    持平: "tag warn"
  };

  return `
    <section class="card">
      <h2>失败原因 Top 摘要</h2>
      <div class="detail-list">
        ${insights.topReasons.map((item) => `
          <div class="detail-item">
            <strong>Top ${escapeHtml(item.rank)}</strong>
            <div>${escapeHtml(item.label)}</div>
            <div class="meta-list" style="margin-top:8px;">
              <span class="tag warn">${escapeHtml(item.count)} 次</span>
              <span class="muted">占最近失败事件 ${escapeHtml(item.ratio)}%</span>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="notice" style="margin-top:16px;">
        <strong>按原因的最近变化提示</strong>
        <div class="stack" style="margin-top:10px;">
          ${insights.changeHints.map((item) => `
            <div class="meta-list">
              <span class="${trendClassMap[item.trend] || "tag"}">${escapeHtml(item.trend)}</span>
              <span><strong>${escapeHtml(item.label)}</strong></span>
              <span class="muted">${escapeHtml(item.summary)}</span>
            </div>
          `).join("")}
        </div>
        <div class="muted" style="margin-top:10px;">比较口径：最近 ${escapeHtml(insights.recentWindowSize)} 条失败相关事件 vs 上一阶段同等窗口。</div>
      </div>
      <div class="notice" style="margin-top:16px;">
        <strong>Top 1 最近失败样本</strong>
        <div class="stack" style="margin-top:10px;">
          ${insights.topReasonRecentSamples.length > 0 ? insights.topReasonRecentSamples.map((item) => `
            <div class="notice-sample">
              <div class="meta-list">
                <span class="tag warn">${escapeHtml(item.reason)}</span>
                <span class="muted">${escapeHtml(item.at || "")}</span>
                ${item.stage ? `<span class="muted">阶段：${escapeHtml(item.stage)}</span>` : ""}
                ${item.attempt ? `<span class="muted">第 ${escapeHtml(item.attempt)} 次</span>` : ""}
              </div>
              <div class="muted" style="margin-top:6px;">${escapeHtml(item.error || "")}</div>
              ${item.url || item.query ? `<div class="muted break-all" style="margin-top:6px;">${escapeHtml(item.url || item.query)}</div>` : ""}
            </div>
          `).join("") : `<div class="muted">暂无 Top 1 失败样本</div>`}
        </div>
      </div>
    </section>
  `;
}

// ========== 第二部分：任务页与任务详情页 ==========
function renderTasksPage(tasks, overview = {}) {
  const summary = {
    total: tasks.length,
    running: tasks.filter((task) => task.status === "running").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    leads: overview.leads || 0,
    pendingReview: overview.pendingReview || 0,
    kept: overview.kept || 0
  };

  const taskRows = tasks.map((task) => `
    <tr>
      <td><a href="/tasks/${escapeHtml(task.id)}">${escapeHtml(task.id)}</a></td>
      <td>${escapeHtml(task.keyword)}</td>
      <td>${escapeHtml(taskRegionLabel(task))}</td>
      <td>${escapeHtml((task.sourceScope || []).join("、"))}</td>
      <td>${escapeHtml(task.plannedCount)}</td>
      <td>${escapeHtml(task.completedCount)}</td>
      <td>${escapeHtml(`${task.successCount}/${task.failureCount}`)}</td>
      <td><span class="tag">${escapeHtml(task.status)}</span></td>
      <td>${escapeHtml(task.lastError || "无")}</td>
      <td>${escapeHtml(task.createdAt)}</td>
    </tr>
    <tr>
      <td colspan="10">
        ${renderTaskDiagnostics(task, { compact: true })}
        <div class="actions">
          <a class="button secondary" href="/tasks/${escapeHtml(task.id)}">查看任务详情</a>
        </div>
      </td>
    </tr>
  `).join("");

  return renderLayout("任务页", `
    <div class="grid">
      <section class="card">
        <h2>新建采集任务</h2>
        <form method="post" action="/tasks/create">
          <div class="form-grid">
            <label>省份
              <input name="province" placeholder="例如：浙江" />
            </label>
            <label>城市
              <input name="city" placeholder="例如：杭州，可留空做省级任务" />
            </label>
            <label>关键词
              <input name="keyword" placeholder="例如：高定木作 展厅" required />
            </label>
            <label>计划抓取数量
              <input type="number" name="plannedCount" min="1" max="5000" value="100" required />
            </label>
          </div>
          <p class="muted">支持省级或城市级任务，计划数量上限已放开到 5000。省份和城市至少填写一项。</p>
          <div class="actions">
            <div class="checkbox-row">
              ${["搜索结果", "官网", "地图", "公众号", "抖音", "小红书", "行业平台"].map((scope, index) => `
                <label class="checkbox-pill">
                  <input type="checkbox" name="sourceScope" value="${scope}" ${index < 3 ? "checked" : ""} />
                  ${scope}
                </label>
              `).join("")}
            </div>
          </div>
          <div class="actions">
            <button type="submit">创建并开始执行</button>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>任务总览</h2>
        <div class="summary">
          <div class="summary-item"><strong>${summary.total}</strong>总任务数</div>
          <div class="summary-item"><strong>${summary.running}</strong>运行中</div>
          <div class="summary-item"><strong>${summary.completed}</strong>已完成</div>
          <div class="summary-item"><strong>${summary.leads}</strong>线索总数</div>
          <div class="summary-item"><strong>${summary.pendingReview}</strong>待审核</div>
          <div class="summary-item"><strong>${summary.kept}</strong>已保留</div>
        </div>
        <p class="muted" style="margin-top:12px;">当前版本已切换为 PostgreSQL 存储，任务详情页会进一步展开趋势和失败原因分类。</p>
      </section>

      <section class="card">
        <h2>Demo 体验入口</h2>
        <p class="muted">如果你现在只是想看后台效果，可以直接加载本地演示数据。演示样例只包含公开商务字段，并且只围绕高定木作业务范围。</p>
        <form method="post" action="/demo/reset">
          <div class="actions">
            <button type="submit">加载演示数据</button>
            <a class="button secondary" href="/results">查看结果页</a>
            <a class="button secondary" href="/library">查看线索库</a>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>任务列表</h2>
        <table>
          <thead>
            <tr>
              <th>任务 ID</th>
              <th>关键词</th>
              <th>地区</th>
              <th>来源范围</th>
              <th>计划数量</th>
              <th>已完成</th>
              <th>成功/失败</th>
              <th>状态</th>
              <th>最近错误</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows || `<tr><td colspan="10" class="muted">暂无任务</td></tr>`}
          </tbody>
        </table>
      </section>
    </div>
  `);
}

function renderTaskDetailPage(task, leads = []) {
  const failureTrend = buildTrendBuckets(task.failureSamples || [], (item) => item.at);
  const successTrend = buildTrendBuckets(leads || [], (item) => item.createdAt);
  const failureReasonBuckets = buildFailureReasonBuckets(task.failureSamples || [], task.retryRecords || []);
  const failureReasonInsights = buildFailureReasonInsights(task.failureSamples || [], task.retryRecords || []);

  return renderLayout("任务详情页", `
    <div class="grid">
      <section class="card">
        <div class="actions" style="margin-top:0;">
          <a class="button secondary" href="/tasks">返回任务列表</a>
          <a class="button secondary" href="/results">查看全部结果</a>
        </div>
      </section>

      <section class="card half">
        <h2>任务基本信息</h2>
        <div class="detail-list">
          <div class="detail-item"><strong>任务 ID</strong>${escapeHtml(task.id)}</div>
          <div class="detail-item"><strong>关键词</strong>${escapeHtml(task.keyword)}</div>
          <div class="detail-item"><strong>地区</strong>${escapeHtml(taskRegionLabel(task))}</div>
          <div class="detail-item"><strong>来源范围</strong>${escapeHtml((task.sourceScope || []).join("、") || "未指定")}</div>
          <div class="detail-item"><strong>创建时间</strong>${escapeHtml(task.createdAt || "")}</div>
          <div class="detail-item"><strong>完成时间</strong>${escapeHtml(task.finishedAt || "未完成")}</div>
        </div>
      </section>

      <section class="card half">
        <h2>当前候选页状态</h2>
        ${renderTaskStatePanel(task)}
      </section>

      ${renderTrendPanel("最近失败趋势", failureTrend, "暂无失败趋势数据", "warn")}
      ${renderTrendPanel("最近成功入池趋势", successTrend, "暂无成功入池趋势数据", "success")}
      ${renderTrendPanel("最近失败原因分类", failureReasonBuckets, "暂无失败原因数据", "warn")}
      ${renderFailureReasonInsightPanel(failureReasonInsights)}

      <section class="card">
        <h2>任务诊断展开</h2>
        ${renderTaskDiagnostics(task)}
      </section>

      <section class="card">
        <h2>失败链接样本明细</h2>
        ${renderTaskEventTable(task.failureSamples || [], [
          { label: "时间", render: (item) => item.at || "" },
          { label: "链接", render: (item) => item.url || "", className: "break-all" },
          { label: "错误", render: (item) => item.error || "" },
          { label: "原因分类", render: (item) => categorizeFailureReason(item.error || "") }
        ], "暂无失败链接样本")}
      </section>

      <section class="card">
        <h2>重试记录明细</h2>
        ${renderTaskEventTable(task.retryRecords || [], [
          { label: "时间", render: (item) => item.at || "" },
          { label: "阶段", render: (item) => item.stage || "" },
          { label: "次数", render: (item) => item.attempt || "" },
          { label: "查询 / 链接", render: (item) => item.url || item.query || "", className: "break-all" },
          { label: "错误", render: (item) => item.error || "" },
          { label: "原因分类", render: (item) => categorizeFailureReason(item.error || "") }
        ], "暂无重试记录")}
      </section>

      <section class="card">
        <h2>该任务最近线索</h2>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>品牌</th>
              <th>线索类型</th>
              <th>来源平台</th>
              <th>匹配分</th>
              <th>审核状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${renderTaskLeadRows(leads)}</tbody>
        </table>
      </section>
    </div>
  `);
}

// ========== 第三部分：结果页与审核页 ==========
function renderResultsPage(leads, filters) {
  const stats = {
    total: leads.length,
    highPriority: leads.filter((lead) => Number(lead.matchScore) >= 80).length,
    pendingReview: leads.filter((lead) => lead.reviewStatus === "待审核").length,
    duplicates: leads.filter((lead) => lead.duplicateState && lead.duplicateState !== "normal").length
  };

  const leadRows = leads.map((lead) => `
    <tr>
      <td>
        <strong>${escapeHtml(lead.name)}</strong><br />
        <span class="muted">${escapeHtml(lead.rawTitle || "")}</span>
      </td>
      <td>${escapeHtml(lead.brand)}</td>
      <td>${escapeHtml([lead.province, lead.city].filter((value, index, array) => value && array.indexOf(value) === index).join(" / "))}</td>
      <td>${escapeHtml(lead.contact)}</td>
      <td>${escapeHtml(lead.address)}</td>
      <td>${escapeHtml(lead.leadType)}</td>
      <td>${escapeHtml(lead.sourcePlatform)}</td>
      <td>
        <span class="${scoreClass(lead.matchScore)}">${escapeHtml(lead.matchScore)}</span><br />
        <span class="${priorityLabel(lead.matchScore).className}">${priorityLabel(lead.matchScore).label}</span>
      </td>
      <td><span class="tag">${escapeHtml(lead.reviewStatus)}</span></td>
      <td>
        <span class="${lead.duplicateState && lead.duplicateState !== "normal" ? "tag warn" : "tag"}">${escapeHtml(duplicateLabel(lead.duplicateState || "normal"))}</span><br />
        <a href="/review/${escapeHtml(lead.id)}">进入审核</a>
      </td>
    </tr>
    <tr>
      <td colspan="10">
        <div class="meta-list">
          <a href="${escapeHtml(lead.sourceUrl)}" target="_blank" rel="noreferrer">查看来源</a>
          <span class="muted">摘要：${escapeHtml((lead.rawSummary || "").slice(0, 90))}${lead.rawSummary && lead.rawSummary.length > 90 ? "..." : ""}</span>
        </div>
        <div class="reason-list" style="margin-top:8px;">
          ${renderReasons((lead.scoreReasons || []).slice(0, 4))}
        </div>
      </td>
    </tr>
  `).join("");

  return renderLayout("结果页", `
    <div class="grid">
      <section class="card">
        <h2>结果总览</h2>
        <div class="summary">
          <div class="summary-item"><strong>${stats.total}</strong>当前结果数</div>
          <div class="summary-item"><strong>${stats.highPriority}</strong>高优先</div>
          <div class="summary-item"><strong>${stats.pendingReview}</strong>待审核</div>
          <div class="summary-item"><strong>${stats.duplicates}</strong>疑似重复</div>
        </div>
      </section>

      <section class="card">
        <h2>结果筛选</h2>
        <form method="get" action="/results">
          <div class="form-grid">
            <label>审核状态
              <select name="reviewStatus">
                <option value="">全部</option>
                ${["待审核", "已保留", "已丢弃"].map((item) => `<option value="${item}" ${filters.reviewStatus === item ? "selected" : ""}>${item}</option>`).join("")}
              </select>
            </label>
            <label>城市
              <input name="city" value="${escapeHtml(filters.city || "")}" placeholder="例如：杭州" />
            </label>
            <label>省份
              <input name="province" value="${escapeHtml(filters.province || "")}" placeholder="例如：浙江" />
            </label>
            <label>品牌
              <input name="brand" value="${escapeHtml(filters.brand || "")}" placeholder="例如：木序" />
            </label>
            <label>线索类型
              <input name="leadType" value="${escapeHtml(filters.leadType || "")}" placeholder="例如：高定木作" />
            </label>
            <label>来源平台
              <input name="sourcePlatform" value="${escapeHtml(filters.sourcePlatform || "")}" placeholder="例如：官网" />
            </label>
            <label>最低分
              <input type="number" name="minScore" min="0" max="100" value="${escapeHtml(filters.minScore || "")}" />
            </label>
            <label>直接搜索
              <input name="q" value="${escapeHtml(filters.q || "")}" placeholder="名称 / 品牌 / 地址 / 联系方式" />
            </label>
          </div>
          <div class="actions">
            <button type="submit">应用筛选</button>
            <a class="button secondary" href="/results">重置</a>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>线索结果</h2>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>品牌</th>
              <th>地区</th>
              <th>联系方式</th>
              <th>地址</th>
              <th>线索类型</th>
              <th>来源平台</th>
              <th>匹配分</th>
              <th>审核状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${leadRows || `<tr><td colspan="10" class="muted">暂无结果</td></tr>`}
          </tbody>
        </table>
      </section>
    </div>
  `);
}

function renderReviewPage(lead) {
  const priority = priorityLabel(lead.matchScore);
  const hasDuplicate = lead.duplicateState && lead.duplicateState !== "normal";

  return renderLayout("审核页", `
    <div class="grid">
      <section class="card half">
        <h2>线索审核</h2>
        <form method="post" action="/review/${escapeHtml(lead.id)}">
          <div class="form-grid">
            <label>名称
              <input name="name" value="${escapeHtml(lead.name)}" />
            </label>
            <label>品牌
              <input name="brand" value="${escapeHtml(lead.brand)}" />
            </label>
            <label>城市
              <input value="${escapeHtml(lead.city)}" disabled />
            </label>
            <label>联系方式
              <input name="contact" value="${escapeHtml(lead.contact)}" />
            </label>
            <label>地址
              <input name="address" value="${escapeHtml(lead.address)}" />
            </label>
            <label>线索类型
              <select name="leadType">
                ${["高定木作", "木作展厅", "全案工作室", "私宅木作", "木门墙柜一体", "原木定制", "其他木作相关"].map((item) => `<option value="${item}" ${lead.leadType === item ? "selected" : ""}>${item}</option>`).join("")}
              </select>
            </label>
            <label>审核状态
              <select name="reviewStatus">
                ${["待审核", "已保留", "已丢弃"].map((item) => `<option value="${item}" ${lead.reviewStatus === item ? "selected" : ""}>${item}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="actions">
            <button type="submit">保存审核结果</button>
            <button type="submit" class="secondary" name="reviewStatus" value="已保留">直接保留</button>
            <button type="submit" class="danger" name="reviewStatus" value="已丢弃">直接丢弃</button>
          </div>
        </form>
      </section>

      <section class="card half">
        <h2>来源与摘要</h2>
        <div class="stack">
          <div class="notice">
            <strong>质量提示</strong>
            <div class="meta-list">
              <span class="${priority.className}">${priority.label}</span>
              <span class="${hasDuplicate ? "tag warn" : "tag success"}">${escapeHtml(duplicateLabel(lead.duplicateState || "normal"))}</span>
              <span class="tag">${escapeHtml(lead.reviewStatus)}</span>
            </div>
          </div>

          <div class="notice">
            <strong>评分依据</strong>
            <div class="reason-list">
              ${renderReasons(lead.scoreReasons || [])}
            </div>
          </div>
        </div>

        <div class="detail-list">
          <div class="detail-item"><strong>来源平台</strong>${escapeHtml(lead.sourcePlatform)}</div>
          <div class="detail-item"><strong>匹配分</strong><span class="${scoreClass(lead.matchScore)}">${escapeHtml(lead.matchScore)}</span></div>
          <div class="detail-item"><strong>来源链接</strong><a href="${escapeHtml(lead.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(lead.sourceUrl)}</a></div>
          <div class="detail-item"><strong>重复状态</strong>${escapeHtml(lead.duplicateState || "normal")}</div>
          <div class="detail-item"><strong>疑似重复来源</strong>${escapeHtml(lead.duplicateOf || "无")}</div>
          <div class="detail-item"><strong>原始标题</strong>${escapeHtml(lead.rawTitle || "无")}</div>
        </div>
        <h3>原始抓取摘要</h3>
        <pre class="excerpt">${escapeHtml(lead.rawSummary || "")}</pre>
      </section>
    </div>
  `);
}

// ========== 第四部分：线索库页 ==========
function renderLibraryPage(leads, filters) {
  const rows = leads.map((lead) => `
    <tr>
      <td>${escapeHtml(lead.name)}</td>
      <td>${escapeHtml(lead.brand)}</td>
      <td>${escapeHtml([lead.province, lead.city].filter((value, index, array) => value && array.indexOf(value) === index).join(" / "))}</td>
      <td>${escapeHtml(lead.contact)}</td>
      <td>${escapeHtml(lead.address)}</td>
      <td>${escapeHtml(lead.leadType)}</td>
      <td>${escapeHtml(lead.sourcePlatform)}</td>
      <td class="${scoreClass(lead.matchScore)}">${escapeHtml(lead.matchScore)}</td>
      <td><a href="${escapeHtml(lead.sourceUrl)}" target="_blank" rel="noreferrer">查看来源</a></td>
    </tr>
  `).join("");

  return renderLayout("线索库", `
    <div class="grid">
      <section class="card">
        <h2>线索库筛选</h2>
        <form method="get" action="/library">
          <div class="form-grid">
            <label>省份
              <input name="province" value="${escapeHtml(filters.province || "")}" />
            </label>
            <label>城市
              <input name="city" value="${escapeHtml(filters.city || "")}" />
            </label>
            <label>品牌
              <input name="brand" value="${escapeHtml(filters.brand || "")}" />
            </label>
            <label>线索类型
              <input name="leadType" value="${escapeHtml(filters.leadType || "")}" />
            </label>
            <label>来源平台
              <input name="sourcePlatform" value="${escapeHtml(filters.sourcePlatform || "")}" />
            </label>
            <label>最低分
              <input type="number" name="minScore" min="0" max="100" value="${escapeHtml(filters.minScore || "")}" />
            </label>
            <label>直接搜索
              <input name="q" value="${escapeHtml(filters.q || "")}" placeholder="名称 / 品牌 / 地址 / 联系方式" />
            </label>
          </div>
          <div class="actions">
            <button type="submit">应用筛选</button>
            <a class="button secondary" href="/library">重置</a>
            <a class="button secondary" href="/api/leads/export.csv">导出 CSV</a>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>已保留线索</h2>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>品牌</th>
              <th>地区</th>
              <th>联系方式</th>
              <th>地址</th>
              <th>线索类型</th>
              <th>来源平台</th>
              <th>匹配分</th>
              <th>来源链接</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="9" class="muted">暂无已保留线索</td></tr>`}
          </tbody>
        </table>
      </section>
    </div>
  `);
}

module.exports = {
  renderTasksPage,
  renderTaskDetailPage,
  renderResultsPage,
  renderReviewPage,
  renderLibraryPage
};
