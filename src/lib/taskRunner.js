/**
 * 文件说明：该文件实现任务执行器与核心业务服务。
 * 功能说明：负责任务创建、异步执行、候选页抓取、字段提取、评分去重和审核更新，并记录进度、失败样本与重试记录。
 *
 * 结构概览：
 *   第一部分：查询与持久化辅助
 *   第二部分：任务执行器
 *   第三部分：对外服务函数
 */

const { generateId, listTasks: loadTasks, listLeads: loadLeads, getTaskById, getLeadById, upsertTask, upsertLead } = require("./storage");
const { fetchTextWithRetry, sleep } = require("./http");
const { searchPublicCandidates } = require("./providers/searchProvider");
const { buildLeadFromHtml } = require("./extractor");
const { detectDuplicate } = require("./dedupe");
const { DEFAULT_SOURCE_SCOPE } = require("../config/platforms");

// ========== 第一部分：查询与持久化辅助 ==========
const RUNNING_TASKS = new Set();
const FAILURE_SAMPLE_LIMIT = 5;
const RETRY_RECORD_LIMIT = 20;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeTaskInput(payload) {
  return {
    province: String(payload.province || "").trim(),
    city: String(payload.city || "").trim(),
    keyword: String(payload.keyword || "").trim(),
    plannedCount: Math.max(1, Math.min(5000, Number(payload.plannedCount || 10))),
    sourceScope: Array.isArray(payload.sourceScope) && payload.sourceScope.length > 0 ? payload.sourceScope : DEFAULT_SOURCE_SCOPE
  };
}

function appendLimited(list, value, limit) {
  return [value, ...(Array.isArray(list) ? list : [])].slice(0, limit);
}

function buildProgress(task, next = {}) {
  return {
    stage: next.stage || task.latestProgress?.stage || "pending",
    message: next.message || task.latestProgress?.message || "",
    processedCount: Number(next.processedCount ?? task.completedCount ?? 0),
    targetCount: Number(next.targetCount ?? task.plannedCount ?? 0),
    currentUrl: next.currentUrl ?? task.latestProgress?.currentUrl ?? "",
    currentQuery: next.currentQuery ?? task.latestProgress?.currentQuery ?? "",
    updatedAt: nowIso()
  };
}

async function findTask(taskId) {
  return getTaskById(taskId);
}

async function findLead(leadId) {
  return getLeadById(leadId);
}

async function updateTask(taskId, updater) {
  const task = await getTaskById(taskId);
  if (!task) {
    return null;
  }

  const nextTask = updater(task);
  await upsertTask(nextTask);
  return nextTask;
}

async function pushRetryRecord(taskId, record) {
  await updateTask(taskId, (task) => ({
    ...task,
    retryRecords: appendLimited(task.retryRecords, record, RETRY_RECORD_LIMIT),
    latestProgress: buildProgress(task, {
      stage: record.stage || task.latestProgress?.stage || "retry",
      currentUrl: record.url || task.latestProgress?.currentUrl || "",
      currentQuery: record.query || task.latestProgress?.currentQuery || "",
      message: `${record.stage === "candidate_search" ? "候选搜索" : "页面抓取"}重试第 ${record.attempt} 次：${record.error}`
    }),
    lastError: record.error || task.lastError
  }));
}

async function pushFailureSample(taskId, sample) {
  await updateTask(taskId, (task) => ({
    ...task,
    failureSamples: appendLimited(task.failureSamples, sample, FAILURE_SAMPLE_LIMIT),
    lastError: sample.error || task.lastError
  }));
}

async function saveLead(lead) {
  await upsertLead(lead);
  return lead;
}

// ========== 第二部分：任务执行器 ==========
async function runTask(taskId) {
  if (RUNNING_TASKS.has(taskId)) {
    return;
  }

  const currentTask = await findTask(taskId);
  if (!currentTask) {
    return;
  }

  RUNNING_TASKS.add(taskId);

  await updateTask(taskId, (task) => ({
    ...task,
    status: "running",
    startedAt: task.startedAt || nowIso(),
    lastError: "",
    latestProgress: buildProgress(task, {
      stage: "candidate_search",
      message: "开始收集候选页面",
      processedCount: task.completedCount,
      targetCount: task.plannedCount
    })
  }));

  try {
    const latestTask = await findTask(taskId);
    const candidateLimit = Math.min(Math.max(latestTask.plannedCount, 30), 5000);
    const candidates = await searchPublicCandidates(latestTask, candidateLimit, {
      onProgress: async (payload) => {
        await updateTask(taskId, (task) => ({
          ...task,
          latestProgress: buildProgress(task, {
            stage: "candidate_search",
            currentQuery: payload.query,
            message: `正在搜索候选页，第 ${payload.pageIndex + 1} 页，已收集 ${payload.foundCount} 条候选链接`
          })
        }));
      },
      onRetry: async (payload) => {
        await pushRetryRecord(taskId, {
          stage: payload.stage,
          query: payload.query || "",
          url: payload.url,
          attempt: payload.attempt,
          error: payload.error,
          at: nowIso()
        });
      }
    });

    for (const url of candidates) {
      const task = await findTask(taskId);

      if (!task || task.successCount >= task.plannedCount) {
        break;
      }

      await updateTask(taskId, (state) => ({
        ...state,
        latestProgress: buildProgress(state, {
          stage: "page_fetch",
          currentUrl: url,
          message: `正在抓取第 ${state.completedCount + 1} 条候选页面`
        })
      }));

      try {
        const html = await fetchTextWithRetry(url, {
          retries: 2,
          timeoutMs: 10000,
          onRetry: async (payload) => {
            await pushRetryRecord(taskId, {
              stage: "page_fetch",
              url: payload.url,
              attempt: payload.attempt,
              error: payload.error,
              at: nowIso()
            });
          }
        });
        const draftLead = buildLeadFromHtml({ task, url, html });
        const duplicate = detectDuplicate(await loadLeads(), draftLead);
        const lead = {
          id: generateId("lead"),
          taskId: task.id,
          ...draftLead,
          duplicateState: duplicate.duplicateState,
          duplicateOf: duplicate.duplicateOf,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };

        await saveLead(lead);

        await updateTask(taskId, (state) => ({
          ...state,
          completedCount: state.completedCount + 1,
          successCount: state.successCount + 1,
          latestProgress: buildProgress(state, {
            stage: "lead_saved",
            processedCount: state.completedCount + 1,
            currentUrl: url,
            message: `已入库 ${state.successCount + 1} 条线索，累计处理 ${state.completedCount + 1} 条候选`
          })
        }));
      } catch (error) {
        await pushFailureSample(taskId, {
          url,
          error: error.message,
          at: nowIso()
        });

        await updateTask(taskId, (state) => ({
          ...state,
          completedCount: state.completedCount + 1,
          failureCount: state.failureCount + 1,
          lastError: error.message,
          latestProgress: buildProgress(state, {
            stage: "page_failed",
            processedCount: state.completedCount + 1,
            currentUrl: url,
            message: `候选页面抓取失败，累计失败 ${state.failureCount + 1} 条`
          })
        }));
      }

      // 这里显式限速，避免连续高频抓取。
      await sleep(900);
    }

    await updateTask(taskId, (task) => ({
      ...task,
      status: task.status === "failed" ? "failed" : "completed",
      finishedAt: nowIso(),
      latestProgress: buildProgress(task, {
        stage: "completed",
        processedCount: task.completedCount,
        message: `任务完成，成功 ${task.successCount} 条，失败 ${task.failureCount} 条`
      })
    }));
  } catch (error) {
    await updateTask(taskId, (task) => ({
      ...task,
      status: "failed",
      finishedAt: nowIso(),
      lastError: error.message,
      latestProgress: buildProgress(task, {
        stage: "failed",
        message: `任务失败：${error.message}`
      })
    }));
  } finally {
    RUNNING_TASKS.delete(taskId);
  }
}

function queueTask(taskId) {
  setTimeout(() => {
    runTask(taskId).catch(() => {
      // 这里不向外抛出未处理异常，避免异步队列导致进程退出。
    });
  }, 10);
}

// ========== 第三部分：对外服务函数 ==========
async function createTask(payload) {
  const input = sanitizeTaskInput(payload);

  if ((!input.city && !input.province) || !input.keyword) {
    throw new Error("省份/城市至少填写一项，且关键词不能为空");
  }

  const task = {
    id: generateId("task"),
    province: input.province,
    city: input.city,
    keyword: input.keyword,
    plannedCount: input.plannedCount,
    sourceScope: input.sourceScope,
    completedCount: 0,
    successCount: 0,
    failureCount: 0,
    status: "pending",
    latestProgress: {
      stage: "pending",
      message: "任务已创建，等待执行",
      processedCount: 0,
      targetCount: input.plannedCount,
      currentUrl: "",
      currentQuery: "",
      updatedAt: nowIso()
    },
    failureSamples: [],
    retryRecords: [],
    createdAt: nowIso(),
    startedAt: "",
    finishedAt: "",
    lastError: ""
  };

  await upsertTask(task);
  queueTask(task.id);
  return task;
}

async function listTasks() {
  return loadTasks();
}

async function listLeads(filters = {}) {
  return loadLeads({
    taskId: filters.taskId || "",
    reviewStatus: filters.reviewStatus || "",
    province: filters.province || "",
    city: filters.city || "",
    brand: filters.brand || "",
    sourcePlatform: filters.sourcePlatform || "",
    leadType: filters.leadType || "",
    minScore: filters.minScore || "",
    q: String(filters.q || "").trim(),
    limit: filters.limit || ""
  });
}

async function reviewLead(leadId, payload) {
  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new Error("线索不存在");
  }

  const nextLead = {
    ...lead,
    name: String(payload.name || lead.name).trim(),
    brand: String(payload.brand ?? lead.brand ?? "").trim(),
    contact: String(payload.contact ?? lead.contact ?? "").trim(),
    address: String(payload.address ?? lead.address ?? "").trim(),
    leadType: String(payload.leadType || lead.leadType).trim(),
    reviewStatus: ["待审核", "已保留", "已丢弃"].includes(payload.reviewStatus) ? payload.reviewStatus : lead.reviewStatus,
    updatedAt: nowIso()
  };

  await upsertLead(nextLead);
  return nextLead;
}

module.exports = {
  createTask,
  listTasks,
  listLeads,
  findLead,
  reviewLead,
  findTask
};
