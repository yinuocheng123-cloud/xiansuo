/**
 * 文件说明：该文件是高定木作公开商务线索采集系统 MVP 的服务入口。
 * 功能说明：提供页面路由、JSON API、任务创建、结果查询、审核更新与导出下载能力。
 *
 * 结构概览：
 *   第一部分：基础依赖与工具
 *   第二部分：请求解析与响应工具
 *   第三部分：页面与 API 路由
 *   第四部分：服务启动
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { ensureStorage } = require("./lib/storage");
const { createTask, listTasks, listLeads, findLead, reviewLead, findTask } = require("./lib/taskRunner");
const { renderTasksPage, renderTaskDetailPage, renderResultsPage, renderReviewPage, renderLibraryPage } = require("./lib/render");
const { leadsToCsv } = require("./lib/csv");
const { seedDemoData } = require("./lib/demoData");

// ========== 第一部分：基础依赖与工具 ==========
const PORT = Number(process.env.PORT || 3000);

// ========== 第二部分：请求解析与响应工具 ==========
function sendHtml(res, html, statusCode = 200) {
  res.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function notFound(res) {
  sendJson(res, { error: "Not Found" }, 404);
}

function serveStatic(req, res, pathname) {
  const filePath = path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));

  if (!filePath.startsWith(path.join(process.cwd(), "public"))) {
    return false;
  }

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
  res.writeHead(200, { "content-type": contentType });
  res.end(fs.readFileSync(filePath));
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";

      try {
        if (contentType.includes("application/json")) {
          resolve(JSON.parse(body || "{}"));
          return;
        }

        const params = new URLSearchParams(body);
        const data = {};

        for (const [key, value] of params.entries()) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
          } else {
            data[key] = value;
          }
        }

        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function pickLeadFilters(searchParams) {
  return {
    reviewStatus: searchParams.get("reviewStatus") || "",
    province: searchParams.get("province") || "",
    city: searchParams.get("city") || "",
    sourcePlatform: searchParams.get("sourcePlatform") || "",
    leadType: searchParams.get("leadType") || "",
    minScore: searchParams.get("minScore") || "",
    brand: searchParams.get("brand") || "",
    q: searchParams.get("q") || ""
  };
}

async function buildOverview() {
  const leads = await listLeads();
  return {
    leads: leads.length,
    pendingReview: leads.filter((lead) => lead.reviewStatus === "待审核").length,
    kept: leads.filter((lead) => lead.reviewStatus === "已保留").length
  };
}

// ========== 第三部分：页面与 API 路由 ==========
const server = http.createServer(async (req, res) => {
  await ensureStorage();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === "/styles.css") {
      const served = serveStatic(req, res, pathname);
      if (served) {
        return;
      }
    }

    if (req.method === "GET" && pathname === "/") {
      redirect(res, "/tasks");
      return;
    }

    if (req.method === "GET" && pathname === "/tasks") {
      sendHtml(res, renderTasksPage(await listTasks(), await buildOverview()));
      return;
    }

    if (req.method === "GET" && /^\/tasks\/[^/]+$/.test(pathname)) {
      const taskId = pathname.split("/").pop();
      const task = await findTask(taskId);

      if (!task) {
        notFound(res);
        return;
      }

      // 详情页需要完整线索集合来计算成功入池趋势，列表展示层再自行截断最近项。
      const relatedLeads = await listLeads({ taskId });
      sendHtml(res, renderTaskDetailPage(task, relatedLeads));
      return;
    }

    if (req.method === "POST" && pathname === "/tasks/create") {
      const body = await parseBody(req);
      const sourceScope = Array.isArray(body.sourceScope) ? body.sourceScope : body.sourceScope ? [body.sourceScope] : [];
      await createTask({
        province: body.province,
        city: body.city,
        keyword: body.keyword,
        plannedCount: body.plannedCount,
        sourceScope
      });
      redirect(res, "/tasks");
      return;
    }

    if (req.method === "POST" && pathname === "/demo/reset") {
      await seedDemoData();
      redirect(res, "/tasks");
      return;
    }

    if (req.method === "GET" && pathname === "/results") {
      const filters = pickLeadFilters(searchParams);
      sendHtml(res, renderResultsPage(await listLeads(filters), filters));
      return;
    }

    if (req.method === "GET" && /^\/review\/[^/]+$/.test(pathname)) {
      const leadId = pathname.split("/").pop();
      const lead = await findLead(leadId);

      if (!lead) {
        notFound(res);
        return;
      }

      sendHtml(res, renderReviewPage(lead));
      return;
    }

    if (req.method === "POST" && /^\/review\/[^/]+$/.test(pathname)) {
      const leadId = pathname.split("/").pop();
      const body = await parseBody(req);
      await reviewLead(leadId, body);
      redirect(res, "/results");
      return;
    }

    if (req.method === "GET" && pathname === "/library") {
      const filters = pickLeadFilters(searchParams);
      const leads = await listLeads({ ...filters, reviewStatus: "已保留" });
      sendHtml(res, renderLibraryPage(leads, filters));
      return;
    }

    if (req.method === "POST" && pathname === "/api/tasks") {
      const body = await parseBody(req);
      const task = await createTask({
        province: body.province,
        city: body.city,
        keyword: body.keyword,
        plannedCount: body.plannedCount,
        sourceScope: Array.isArray(body.sourceScope) ? body.sourceScope : body.sourceScope ? [body.sourceScope] : []
      });
      sendJson(res, task, 201);
      return;
    }

    if (req.method === "GET" && pathname === "/api/tasks") {
      sendJson(res, await listTasks());
      return;
    }

    if (req.method === "GET" && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
      const taskId = pathname.split("/").pop();
      const task = await findTask(taskId);
      if (!task) {
        notFound(res);
        return;
      }

      sendJson(res, {
        ...task,
        leads: await listLeads({ taskId, limit: 20 })
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/demo/reset") {
      sendJson(res, await seedDemoData(), 201);
      return;
    }

    if (req.method === "GET" && pathname === "/api/results") {
      sendJson(res, await listLeads(pickLeadFilters(searchParams)));
      return;
    }

    if (req.method === "GET" && /^\/api\/results\/[^/]+$/.test(pathname)) {
      const leadId = pathname.split("/").pop();
      const lead = await findLead(leadId);
      if (!lead) {
        notFound(res);
        return;
      }

      sendJson(res, lead);
      return;
    }

    if (req.method === "POST" && /^\/api\/leads\/[^/]+\/review$/.test(pathname)) {
      const leadId = pathname.split("/")[3];
      const body = await parseBody(req);
      sendJson(res, await reviewLead(leadId, body));
      return;
    }

    if (req.method === "GET" && pathname === "/api/leads/export.csv") {
      const leads = await listLeads({ reviewStatus: "已保留" });
      res.writeHead(200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="wood-leads.csv"'
      });
      res.end(`\ufeff${leadsToCsv(leads)}`);
      return;
    }

    notFound(res);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
});

// ========== 第四部分：服务启动 ==========
server.listen(PORT, "127.0.0.1", () => {
  console.log(`高定木作公开商务线索采集系统已启动: http://127.0.0.1:${PORT}`);
});

module.exports = server;
